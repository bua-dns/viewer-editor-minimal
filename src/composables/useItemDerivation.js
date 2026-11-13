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
import {
  buildDerivedFields,
  buildDerivedItemPayload,
  describeCreatedItem,
  findRuleForSource,
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
  fetchRow: ({ profile, token, itemsPath, id }) => fetchCollectionItemFromStrapi({ profile, token, itemsPath, id }),
  createItem: ({ profile, token, itemsPath, fields }) => createCollectionItemInStrapi({ profile, token, itemsPath, fields }),
}

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

  async function readSavedSourceValues() {
    if (!isSavedOnlineItem(sourceItem)) return {}
    const meta = sourceItem.__onlineMeta
    const row = await services.fetchRow({ ...session(), itemsPath: meta.itemsPath || sourcePath.value, id: meta.id })
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
      // Unsaved edits of the item are shown as they will be saved.
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
      const values = await readSavedSourceValues()
      const fields = buildDerivedItemPayload(rule, values, sourceItem.__onlineMeta)
      const response = await services.createItem({ ...session(), itemsPath: rule.target, fields })
      if (!isCurrent()) return
      update({ phase: 'done', created: describeCreatedItem(response, buildDerivedFields(rule, values)) })
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
