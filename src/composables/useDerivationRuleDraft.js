// Editable draft of the derivation rule of the loaded collection (Konfiguration tab): the target
// collection with its data model, the relation field, the label and the field mappings.
import { computed, ref, watch } from 'vue'
import { fetchCollectionFieldModelFromStrapi, fetchCollectionTypesFromStrapi } from '../services/strapiDataModel'
import { useAuthStore } from '../stores/useAuthStore'
import { useConnectionProfileStore } from '../stores/useConnectionProfileStore'
import { useDerivationRulesStore } from '../stores/useDerivationRulesStore'
import {
  findIncompatibleMappings,
  findRuleForSource,
  normalizeCollectionPath,
  normalizeDerivationRules,
  structureOfField,
  validateDerivationRule,
} from './derivationRules'
import { createRequestSequence } from './requestSequence'

const EMPTY_MODEL = { source: '', fields: [], status: 'idle', errorMessage: '' }
let nextRowKey = 1

function defaultSession() {
  const { connectionProfile } = useConnectionProfileStore()
  const { token } = useAuthStore()
  return { profile: connectionProfile.value, token: token.value || '' }
}

const defaultServices = {
  fetchCollectionTypes: fetchCollectionTypesFromStrapi,
  fetchFieldModel: fetchCollectionFieldModelFromStrapi,
}

function toRow(mapping = {}) {
  const isConstant = Object.prototype.hasOwnProperty.call(mapping, 'value')
  return {
    key: nextRowKey++,
    target: mapping.target || '',
    kind: isConstant ? 'constant' : 'copy',
    from: mapping.from || '',
    prefix: mapping.prefix || '',
    value: isConstant ? mapping.value : '',
    // The stored structure, kept as long as no schema model of the source says otherwise.
    structure: mapping.structure || null,
  }
}

// The source field's structure from the schema model; without that model the stored one.
function rowStructure(row, schemaFields) {
  const field = schemaFields?.get(row.from)
  return field ? structureOfField(field) : row.structure
}

function toMapping(row, schemaFields) {
  if (row.kind === 'constant') return { target: row.target, value: row.value }
  const mapping = { target: row.target, from: row.from }
  if (row.prefix) mapping.prefix = row.prefix
  const structure = rowStructure(row, schemaFields)
  if (structure) mapping.structure = structure
  return mapping
}

function schemaFieldsOf(model) {
  if (model?.source !== 'schema') return null
  return new Map((model.fields || []).map((field) => [field.key, field]))
}

function createDraft(rule, sourcePath) {
  return {
    source: normalizeCollectionPath(sourcePath),
    target: rule?.target || '',
    labelDe: rule?.label?.de || '',
    labelEn: rule?.label?.en || '',
    relationField: rule?.relationField || '',
    rows: (rule?.fields || []).map(toRow),
  }
}

function buildLabel(draft) {
  const label = {}
  if (draft.labelDe.trim()) label.de = draft.labelDe.trim()
  if (draft.labelEn.trim()) label.en = draft.labelEn.trim()
  return label
}

/**
 * The draft as a rule; rows without a target, or copies without a source field, are dropped.
 * With the source's schema model (`{ source: 'schema', fields }`), each copy stores the source
 * field's structure, so deriving needs no schema access later.
 */
export function draftToRule(draft, sourceFieldModel = null) {
  const schemaFields = schemaFieldsOf(sourceFieldModel)
  const [rule] = normalizeDerivationRules([
    {
      source: draft.source,
      target: draft.target,
      label: buildLabel(draft),
      relationField: draft.relationField,
      fields: draft.rows.map((row) => toMapping(row, schemaFields)),
    },
  ])
  return rule
}

const RELATION_TYPES = new Set(['relation'])
const INCOMPLETE_ROW_ERROR = {
  key: 'deriveRuleRowIncomplete',
  fallback: 'Every row needs a target field, and a copy needs a source field.',
}

const INCOMPATIBLE_FIELD_ERROR = {
  key: 'deriveRuleIncompatibleField',
  fallback: 'A component, JSON or blocks field can only be filled from a field of the same structure.',
}

function isIncompleteRow(row) {
  return !row.target || (row.kind === 'copy' && !row.from)
}

/**
 * @param {object} options `sourcePath` (ref of the loaded collection); `sourceFieldModel` (ref of
 *   its `{ source, fields }`, for the compatibility check); `session`, `services` and `saveRule`
 *   (stores the rule, default: the rules store) are injected in tests.
 */
export function useDerivationRuleDraft({
  sourcePath,
  sourceFieldModel = ref(null),
  session = defaultSession,
  services = defaultServices,
  saveRule,
}) {
  const { rules, saveStatus, lastSaveError, saveDerivationRule } = useDerivationRulesStore()
  const storeRule = saveRule || saveDerivationRule
  const storedRule = computed(() => findRuleForSource(rules.value, sourcePath.value))
  const draft = ref(createDraft(storedRule.value, sourcePath.value))
  const collectionTypes = ref([])
  const targetModel = ref(EMPTY_MODEL)
  const targetLoads = createRequestSequence()

  function resetDraft() {
    draft.value = createDraft(storedRule.value, sourcePath.value)
  }

  async function loadCollectionTypes() {
    collectionTypes.value = await services.fetchCollectionTypes(session())
  }

  async function loadTargetModel(targetPath) {
    const isCurrent = targetLoads.start()
    if (!targetPath) {
      targetModel.value = EMPTY_MODEL
      return
    }
    targetModel.value = { ...EMPTY_MODEL, status: 'loading' }
    try {
      const model = await services.fetchFieldModel({ ...session(), itemsPath: targetPath })
      if (isCurrent()) targetModel.value = { ...model, status: 'ready', errorMessage: '' }
    } catch (error) {
      if (isCurrent()) targetModel.value = { ...EMPTY_MODEL, status: 'error', errorMessage: String(error?.message || error) }
    }
  }

  const rule = computed(() => draftToRule(draft.value, sourceFieldModel.value))
  const incompatibleTargets = computed(() =>
    findIncompatibleMappings(rule.value, sourceFieldModel.value?.fields || [], targetModel.value.fields),
  )
  const errors = computed(() => {
    const ruleErrors = validateDerivationRule(rule.value)
    if (draft.value.rows.some(isIncompleteRow)) ruleErrors.push(INCOMPLETE_ROW_ERROR)
    if (incompatibleTargets.value.length) ruleErrors.push(INCOMPATIBLE_FIELD_ERROR)
    return ruleErrors
  })
  const comparedRule = computed(() => storedRule.value || draftToRule(createDraft(null, sourcePath.value)))
  const isDirty = computed(() => JSON.stringify(rule.value) !== JSON.stringify(comparedRule.value))
  const canSave = computed(() => isDirty.value && !errors.value.length && saveStatus.value !== 'saving')

  // Relation attributes of the target; a model guessed from a sample item has no relation types,
  // so its structured fields are offered instead.
  const relationFieldOptions = computed(() => {
    const isGuessed = targetModel.value.source === 'sample'
    return targetModel.value.fields.filter((field) =>
      isGuessed ? field.isStructured : RELATION_TYPES.has(field.strapiType),
    )
  })

  function addRow() {
    draft.value.rows.push(toRow({ target: '', from: '' }))
  }

  function removeRow(key) {
    draft.value.rows = draft.value.rows.filter((row) => row.key !== key)
  }

  async function save() {
    if (!canSave.value) return { ok: false }
    const result = await storeRule(rule.value)
    if (result.ok) resetDraft()
    return result
  }

  watch(storedRule, resetDraft)
  watch(() => sourcePath.value, resetDraft)
  watch(() => draft.value.target, loadTargetModel, { immediate: true })

  return {
    draft,
    collectionTypes,
    targetModel,
    relationFieldOptions,
    errors,
    isDirty,
    canSave,
    saveStatus,
    lastSaveError,
    loadCollectionTypes,
    reloadTargetModel: () => loadTargetModel(draft.value.target),
    addRow,
    removeRow,
    resetDraft,
    save,
  }
}
