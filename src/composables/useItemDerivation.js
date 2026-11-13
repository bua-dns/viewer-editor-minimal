// The click flow of "Derive item": preview the new item's values, save pending changes if there
// are any, read the saved source item, create the target item linked to it, report its label/ID.
import { computed, ref } from 'vue'
import {
  createCollectionItemInStrapi,
  fetchCollectionItemFromStrapi,
  resolveItemsPathFromSettings,
} from '../services/strapiApi'
import { useAuthStore } from '../stores/useAuthStore'
import { useConnectionProfileStore } from '../stores/useConnectionProfileStore'
import { useDerivationRulesStore } from '../stores/useDerivationRulesStore'
import { fetchCollectionFieldModelFromStrapi, fetchComponentSchemasFromStrapi } from '../services/strapiDataModel'
import {
  buildDerivedFields,
  buildDerivedItemPayload,
  describeCreatedItem,
  findRuleForSource,
  findUnresolvedStructuredMappings,
  listPopulatedSourceFields,
  needsSourceFieldModel,
  readLocalItemValues,
  readRowValues,
  resolveRuleLabel,
} from './derivationRules'
import { createRequestSequence } from './requestSequence'

const CLOSED_DIALOG = { isOpen: false, phase: 'idle', targetPath: '', preview: [], willSaveFirst: false, created: null, error: '' }

function defaultSession() {
  const { connectionProfile } = useConnectionProfileStore()
  const { token } = useAuthStore()
  return { profile: connectionProfile.value, token: token.value || '' }
}

const defaultServices = {
  fetchRow: ({ profile, token, itemsPath, id, populateFields }) =>
    fetchCollectionItemFromStrapi({ profile, token, itemsPath, id, populateFields }),
  createItem: ({ profile, token, itemsPath, fields }) => createCollectionItemInStrapi({ profile, token, itemsPath, fields }),
  fetchFieldModel: fetchCollectionFieldModelFromStrapi,
  fetchComponentSchemas: fetchComponentSchemasFromStrapi,
}

const NO_SOURCE_MODELS = { sourceFieldModel: [], componentSchemas: {} }

function isSavedOnlineItem(item) {
  const meta = item?.__onlineMeta
  return Boolean(meta && meta.isDraft !== true && meta.id != null)
}

function toPreview(fields) {
  return Object.entries(fields).map(([field, value]) => ({ field, value }))
}

/**
 * @param {object} options `isEnabled()` (feature switched on, online, signed in), `canEditRules()`
 *   (settings writable), `onlineSettings` (ref; its `itemsPath` is the source collection),
 *   `selectedItem` (ref), `hasPendingChanges` (ref), `saveChanges()` (resolves to true when
 *   everything was saved), `language` (ref), `t(key, fallback)`, `onCreated({ targetPath,
 *   documentId })` (after the item was created); `session` and `services` are
 *   injected in tests.
 */
export function useItemDerivation({
  isEnabled,
  canEditRules = () => false,
  onlineSettings,
  selectedItem,
  hasPendingChanges,
  saveChanges,
  language,
  t,
  onCreated = () => {},
  session = defaultSession,
  services = defaultServices,
}) {
  const { rules, initializeDerivationRules, clearDerivationRules } = useDerivationRulesStore()
  const sourcePath = computed(() => resolveItemsPathFromSettings(onlineSettings.value))
  const dialog = ref(CLOSED_DIALOG)
  const runs = createRequestSequence()
  let sourceItem = null
  let rule = null
  let sourceModels = NO_SOURCE_MODELS

  const activeRule = computed(() => (isEnabled() ? findRuleForSource(rules.value, sourcePath.value) : null))
  const canDerive = computed(() => Boolean(activeRule.value && selectedItem.value))
  const actionLabel = computed(() =>
    resolveRuleLabel(activeRule.value, language.value, t('deriveItemButton', 'Derive item')),
  )
  // The rule editor (Konfiguration tab) is shown for this collection; empty hides it.
  const editorSourcePath = computed(() => (isEnabled() && canEditRules() ? sourcePath.value : ''))

  function update(patch) {
    dialog.value = { ...dialog.value, ...patch }
  }

  function sourceItemsPath() {
    return sourceItem.__onlineMeta.itemsPath || sourcePath.value
  }

  // The source field model, only for older rules without stored structures. A model guessed from a
  // sample item (schema not readable) cannot tell a component from JSON, so it is not used.
  async function loadSchemaFieldModel() {
    if (!needsSourceFieldModel(rule)) return []
    const model = await services.fetchFieldModel({ ...session(), itemsPath: sourceItemsPath() })
    return model?.source === 'schema' ? model.fields || [] : []
  }

  // What populating and cleaning component values needs. The component schemas only add dropping
  // nested media/relations; without them the entries' `id` still goes.
  async function loadSourceModels() {
    if (!isSavedOnlineItem(sourceItem)) return NO_SOURCE_MODELS
    try {
      const sourceFieldModel = await loadSchemaFieldModel()
      const copiesComponents = listPopulatedSourceFields(rule, sourceFieldModel).length > 0
      const componentSchemas = copiesComponents ? await services.fetchComponentSchemas(session()) : {}
      return { sourceFieldModel, componentSchemas: componentSchemas || {} }
    } catch {
      return NO_SOURCE_MODELS
    }
  }

  // An older rule whose structured copies cannot be resolved would drop those values silently.
  function assertStructuresKnown() {
    const unresolved = findUnresolvedStructuredMappings(rule, readLocalItemValues(sourceItem), sourceModels.sourceFieldModel)
    if (!unresolved.length) return
    const message = t(
      'deriveRuleNeedsResave',
      'The rule does not know the structure of {fields}. Open it in the Konfiguration tab (with access to the Strapi data model) and save it again.',
    )
    throw new Error(message.replace('{fields}', unresolved.join(', ')))
  }

  async function readSavedSourceValues() {
    if (!isSavedOnlineItem(sourceItem)) return {}
    const populateFields = listPopulatedSourceFields(rule, sourceModels.sourceFieldModel)
    const id = sourceItem.__onlineMeta.id
    const row = await services.fetchRow({ ...session(), itemsPath: sourceItemsPath(), id, populateFields })
    return readRowValues(row)
  }

  function describeError(error) {
    if (error?.outcomeUnknown) {
      return t(
        'deriveOutcomeUnknown',
        'The connection broke off: the new item may have been created. Check the target collection before trying again.',
      )
    }
    return String(error?.message || error)
  }

  async function openDerivation() {
    if (!canDerive.value) return
    sourceItem = selectedItem.value
    rule = activeRule.value
    const isCurrent = runs.start()
    dialog.value = { ...CLOSED_DIALOG, isOpen: true, phase: 'loading', targetPath: rule.target, willSaveFirst: hasPendingChanges.value }
    try {
      sourceModels = await loadSourceModels()
      if (!isCurrent()) return
      assertStructuresKnown()
      // Unsaved edits of the item are shown as they will be saved. Not cleaned: the viewer holds
      // some components in its own form (Wikidata entries: `id` is the QID), which cleaning would cut.
      const values = { ...(await readSavedSourceValues()), ...readLocalItemValues(sourceItem) }
      if (!isCurrent()) return
      update({ phase: 'preview', preview: toPreview(buildDerivedFields(rule, values)) })
    } catch (error) {
      if (isCurrent()) update({ phase: 'error', error: describeError(error) })
    }
  }

  async function saveFirstIfNeeded() {
    if (!hasPendingChanges.value) return
    const saved = await saveChanges()
    if (!saved) {
      throw new Error(t('deriveSaveFailed', 'Saving the pending changes failed, so no item was created.'))
    }
  }

  async function confirmDerivation() {
    if (dialog.value.phase !== 'preview') return
    const isCurrent = runs.start()
    update({ phase: 'running', error: '' })
    try {
      await saveFirstIfNeeded()
      // A draft got its server identity only now, so its models were not loaded for the preview.
      if (sourceModels === NO_SOURCE_MODELS) sourceModels = await loadSourceModels()
      assertStructuresKnown()
      const values = await readSavedSourceValues()
      const fields = buildDerivedItemPayload(rule, values, sourceItem.__onlineMeta, sourceModels)
      const response = await services.createItem({ ...session(), itemsPath: rule.target, fields })
      if (!isCurrent()) return
      update({ phase: 'done', created: describeCreatedItem(response, buildDerivedFields(rule, values, sourceModels)) })
      onCreated({ targetPath: rule.target, documentId: response?.data?.documentId ?? response?.data?.id ?? '' })
    } catch (error) {
      if (isCurrent()) update({ phase: 'error', error: describeError(error) })
    }
  }

  function closeDerivation() {
    if (dialog.value.phase === 'running') return
    runs.invalidate()
    dialog.value = CLOSED_DIALOG
  }

  return {
    canDerive,
    actionLabel,
    editorSourcePath,
    dialog,
    loadRules: initializeDerivationRules,
    clearRules: clearDerivationRules,
    openDerivation,
    confirmDerivation,
    closeDerivation,
  }
}
