//src\stores\useUserConfigStore.js
import { computed, ref } from 'vue'
import { validateImportedConfigPayload } from '../domain/userConfigValidation'
import {
  createDefaultValueForFieldType,
  normalizeValueForConfiguredType,
  supportsPrefill,
} from '../fields/fieldRegistry'
import { isPlainObject } from '../domain/objects'
import { resolveFirstLevelStaticList, resolveHierarchyFieldsFromSettings } from '../domain/hierarchyConfig'

const EXCLUDED_CONFIG_FIELD_KEYS = new Set(['scan', 'suspendEditing', '__onlineMeta'])
const ALLOWED_FIELD_WIDTHS = new Set(['33%', '50%', '100%'])


// Field config used to be mirrored to the session storage. It is no longer read; remove the leftover.
try {
  globalThis.sessionStorage?.removeItem('viewerEditor.userConfig.v1')
} catch {
  // storage not available: nothing to clean up
}

function cloneValue(value) {
  return JSON.parse(JSON.stringify(value))
}

function isConfigFieldAllowed(fieldKey) {
  const normalized = String(fieldKey || '').trim()
  if (!normalized) return false
  return !EXCLUDED_CONFIG_FIELD_KEYS.has(normalized)
}

function createMinimalAutosuggestConfig() {
  return {
    minChars: 2,
    limit: 50,
  }
}

function createMinimalCandidateConfig() {
  return {
    targetField: '',
    inputType: 'normal',
  }
}

function normalizeCandidateInputType(value) {
  return value === 'text' ? 'text' : 'normal'
}

function normalizeCandidateTargets(fields) {
  if (!isPlainObject(fields)) return

  Object.entries(fields).forEach(([fieldKey, fieldConfig]) => {
    if (!isPlainObject(fieldConfig) || fieldConfig.type !== 'candidate') {
      return
    }

    if (!isPlainObject(fieldConfig.candidate)) {
      fieldConfig.candidate = createMinimalCandidateConfig()
    }

    const normalizedTargetField = String(fieldConfig.candidate.targetField || '').trim()
    const targetConfig = fields[normalizedTargetField]
    const targetType = targetConfig?.type || 'normal'
    const hasValidTarget =
      Boolean(normalizedTargetField) &&
      normalizedTargetField !== fieldKey &&
      isPlainObject(targetConfig) &&
      targetType !== 'candidate'

    fieldConfig.candidate.targetField = hasValidTarget ? normalizedTargetField : ''
    fieldConfig.candidate.inputType = normalizeCandidateInputType(fieldConfig.candidate.inputType)
  })
}

function normalizeStringArray(values) {
  return (Array.isArray(values) ? values : [])
    .map((entry) => String(entry || '').trim())
    .filter(Boolean)
}

function normalizeStringArrayUnique(values) {
  const normalized = normalizeStringArray(values)
  return normalized.filter((value, index, list) => list.indexOf(value) === index)
}

function normalizeFieldWidth(value) {
  const normalized = String(value || '').trim()
  if (ALLOWED_FIELD_WIDTHS.has(normalized)) return normalized
  return '100%'
}

// prefillWith now sits on the field itself; resolvePrefillWith still reads the old autosuggest.prefillWith,
// so it is dropped from the autosuggest block here.
function normalizeAutosuggestConfig(raw) {
  const autosuggest = isPlainObject(raw) ? cloneValue(raw) : createMinimalAutosuggestConfig()
  delete autosuggest.prefillWith
  return autosuggest
}

function normalizeCandidateConfig(raw) {
  const candidate = isPlainObject(raw) ? cloneValue(raw) : createMinimalCandidateConfig()
  candidate.targetField = String(candidate.targetField || '').trim()
  candidate.inputType = normalizeCandidateInputType(candidate.inputType)
  return candidate
}

// Settings every field type has.
function normalizeCommonFieldSettings(source, fallbackOrder) {
  return {
    fieldWidth: normalizeFieldWidth(source.fieldWidth),
    label: source.label || '',
    order: Number.isFinite(source.order) ? source.order : fallbackOrder,
    placeholder: source.placeholder || '',
    hint: typeof source.hint === 'string' ? source.hint : '',
    hidden: source.hidden === true,
  }
}

// The key order of the result is part of the snapshot comparison (serializeUserConfigFields).
function normalizeUserConfigField(source = {}, fallbackOrder = 0) {
  const type = source.type || 'normal'
  const isWikidata = type === 'wikidata-autosuggest'
  const prefillWith = supportsPrefill(type) ? resolvePrefillWith(source) : ''

  return {
    type,
    ...normalizeCommonFieldSettings(source, fallbackOrder),
    ...(isWikidata ? {} : { readOnly: Boolean(source.readOnly) }),
    ...(prefillWith ? { prefillWith } : {}),
    ...(isWikidata ? { autosuggest: normalizeAutosuggestConfig(source.autosuggest) } : {}),
    ...(type === 'candidate' ? { candidate: normalizeCandidateConfig(source.candidate) } : {}),
  }
}

function resolvePrefillWith(source) {
  const value = typeof source.prefillWith === 'string' ? source.prefillWith : source.autosuggest?.prefillWith
  return typeof value === 'string' ? value.trim() : ''
}

function serializeUserConfigFields(fields) {
  const normalized = {}
  Object.keys(fields)
    .sort()
    .forEach((key) => {
      normalized[key] = normalizeUserConfigField(fields[key], 0)
    })
  return JSON.stringify(normalized)
}

function serializeUserConfigState({
  fields = {},
  itemLabelField = '',
  markAsEditedBasis = '',
  showOnlyNonEmptyFields = false,
  hierarchyFields = [],
  firstLevelStaticList = [],
} = {}) {
  return JSON.stringify({
    fields: JSON.parse(serializeUserConfigFields(fields)),
    itemLabelField: String(itemLabelField || ''),
    markAsEditedBasis: String(markAsEditedBasis || ''),
    showOnlyNonEmptyFields: Boolean(showOnlyNonEmptyFields),
    hierarchyFields: normalizeStringArrayUnique(hierarchyFields),
    firstLevelStaticList: normalizeStringArrayUnique(firstLevelStaticList),
  })
}

// One configuration state per scope: the primary collection, and each secondary collection
// (layout v2) shown as linked items. Scope '' is the primary one.
function createUserConfigState() {
  const userConfigFields = ref({})
  const appliedUserConfigFields = ref({})
  const itemLabelField = ref('')
  const appliedItemLabelField = ref('')
  const markAsEditedBasis = ref('')
  const appliedMarkAsEditedBasis = ref('')
  const showOnlyNonEmptyFields = ref(false)
  const appliedShowOnlyNonEmptyFields = ref(false)
  const hierarchyFields = ref([])
  const appliedHierarchyFields = ref([])
  const firstLevelStaticList = ref([])
  const appliedFirstLevelStaticList = ref([])
  const appliedUserConfigSnapshot = ref('')
  const draggedFieldKey = ref('')
  const isUserConfigOpen = ref(false)
  const newFieldName = ref('')
  const addFieldError = ref('')

  function serializeDraftState() {
    return serializeUserConfigState({
      fields: userConfigFields.value,
      itemLabelField: itemLabelField.value,
      markAsEditedBasis: markAsEditedBasis.value,
      showOnlyNonEmptyFields: showOnlyNonEmptyFields.value,
      hierarchyFields: hierarchyFields.value,
      firstLevelStaticList: firstLevelStaticList.value,
    })
  }

  function serializeAppliedState() {
    return serializeUserConfigState({
      fields: appliedUserConfigFields.value,
      itemLabelField: appliedItemLabelField.value,
      markAsEditedBasis: appliedMarkAsEditedBasis.value,
      showOnlyNonEmptyFields: appliedShowOnlyNonEmptyFields.value,
      hierarchyFields: appliedHierarchyFields.value,
      firstLevelStaticList: appliedFirstLevelStaticList.value,
    })
  }

  const sortedConfigFieldEntries = computed(() =>
    Object.entries(userConfigFields.value).sort((a, b) => (a[1].order || 0) - (b[1].order || 0)),
  )

  const hasUnappliedUserConfigChanges = computed(() => serializeDraftState() !== appliedUserConfigSnapshot.value)

  // Field config has no default: it always comes from the data source. Every newly opened
  // data source starts empty until its config is applied or the user builds one.
  function initializeUserConfig() {
    userConfigFields.value = {}
    appliedUserConfigFields.value = {}
    itemLabelField.value = ''
    appliedItemLabelField.value = ''
    markAsEditedBasis.value = ''
    appliedMarkAsEditedBasis.value = ''
    showOnlyNonEmptyFields.value = false
    appliedShowOnlyNonEmptyFields.value = false
    hierarchyFields.value = []
    appliedHierarchyFields.value = []
    firstLevelStaticList.value = []
    appliedFirstLevelStaticList.value = []
    appliedUserConfigSnapshot.value = serializeUserConfigState()
  }

  // Adds keys found in the data as `normal` fields. Reserved and already configured keys are
  // skipped. Returns the keys that were added.
  function addUserConfigFieldsFromDataKeys(dataKeys = []) {
    const added = []
    dataKeys.forEach((rawKey) => {
      const key = String(rawKey || '').trim()
      if (!isConfigFieldAllowed(key)) return
      if (Object.prototype.hasOwnProperty.call(userConfigFields.value, key)) return
      userConfigFields.value[key] = normalizeUserConfigField({}, Object.keys(userConfigFields.value).length)
      added.push(key)
    })
    return added
  }

  function normalizeConfigOrder() {
    const sortedKeys = Object.entries(userConfigFields.value)
      .sort((a, b) => (a[1].order || 0) - (b[1].order || 0))
      .map(([key]) => key)
    sortedKeys.forEach((key, index) => {
      userConfigFields.value[key].order = index
    })
  }

  function applyUserConfigToRawItems(rawItems) {
    normalizeCandidateTargets(userConfigFields.value)
    normalizeConfigOrder()

    const removedFieldKeys = Object.keys(appliedUserConfigFields.value).filter(
      (key) => !Object.prototype.hasOwnProperty.call(userConfigFields.value, key),
    )
    if (removedFieldKeys.length) {
      rawItems.forEach((item) => {
        removedFieldKeys.forEach((key) => delete item[key])
      })
    }

    Object.entries(userConfigFields.value).forEach(([key, config]) => {
      rawItems.forEach((item) => {
        if (!Object.prototype.hasOwnProperty.call(item, key)) {
          item[key] = createDefaultValueForFieldType(config.type)
        }
      })
    })

    rawItems.forEach((item) => {
      Object.keys(userConfigFields.value).forEach((key) => {
        const configuredType = userConfigFields.value[key]?.type
        const currentValue = item[key]
        item[key] = normalizeValueForConfiguredType(configuredType, currentValue)
      })
    })

    appliedUserConfigFields.value = JSON.parse(JSON.stringify(userConfigFields.value))
    appliedItemLabelField.value = itemLabelField.value
    appliedMarkAsEditedBasis.value = markAsEditedBasis.value
    appliedShowOnlyNonEmptyFields.value = showOnlyNonEmptyFields.value
    appliedHierarchyFields.value = normalizeStringArrayUnique(hierarchyFields.value)
    appliedFirstLevelStaticList.value = normalizeStringArrayUnique(firstLevelStaticList.value)
    appliedUserConfigSnapshot.value = serializeAppliedState()
  }

  function setShowOnlyNonEmptyFields(nextValue) {
    showOnlyNonEmptyFields.value = Boolean(nextValue)
  }

  function addHierarchyField() {
    hierarchyFields.value = [...hierarchyFields.value, '']
  }

  function isHierarchyFieldIndex(index) {
    const isInteger = Number.isInteger(index)
    return isInteger && index >= 0 && index < hierarchyFields.value.length
  }

  function updateHierarchyFieldAt(index, nextValue) {
    if (!isHierarchyFieldIndex(index)) return false
    const nextHierarchyFields = [...hierarchyFields.value]
    nextHierarchyFields[index] = String(nextValue || '').trim()
    hierarchyFields.value = nextHierarchyFields
    return true
  }

  function removeHierarchyFieldAt(index) {
    if (!isHierarchyFieldIndex(index)) return false
    hierarchyFields.value = hierarchyFields.value.filter((_, currentIndex) => currentIndex !== index)
    return true
  }

  function setFirstLevelStaticListFromText(nextValue) {
    const tokens = String(nextValue || '')
      .split(/[\n,]/)
      .map((entry) => String(entry || '').trim())
      .filter(Boolean)
    firstLevelStaticList.value = normalizeStringArrayUnique(tokens)
  }

  function sanitizeFieldName(name) {
    return name.trim().replace(/\s+/g, '_')
  }

  function addUserConfigField(t) {
    const nextKey = sanitizeFieldName(newFieldName.value)
    addFieldError.value = ''
    if (!nextKey) {
      addFieldError.value = t('addFieldEmptyError', 'Bitte einen gueltigen Feldnamen eingeben.')
      return
    }
    if (Object.prototype.hasOwnProperty.call(userConfigFields.value, nextKey)) {
      addFieldError.value = t('addFieldDuplicateError', 'Feld existiert bereits.')
      return
    }
    if (!isConfigFieldAllowed(nextKey)) {
      addFieldError.value = t('addFieldReservedError', 'Feldname ist reserviert.')
      return
    }

    userConfigFields.value[nextKey] = normalizeUserConfigField({}, Object.keys(userConfigFields.value).length)
    newFieldName.value = ''
  }

  function removeUserConfigField(fieldKey) {
    if (!Object.prototype.hasOwnProperty.call(userConfigFields.value, fieldKey)) return
    delete userConfigFields.value[fieldKey]
    if (itemLabelField.value === fieldKey) {
      itemLabelField.value = ''
    }
    if (appliedItemLabelField.value === fieldKey) {
      appliedItemLabelField.value = ''
    }
    if (markAsEditedBasis.value === fieldKey) {
      markAsEditedBasis.value = ''
    }
    if (appliedMarkAsEditedBasis.value === fieldKey) {
      appliedMarkAsEditedBasis.value = ''
    }
    normalizeCandidateTargets(userConfigFields.value)
  }

  function setItemLabelField(nextFieldKey) {
    const normalized = String(nextFieldKey || '').trim()
    if (!normalized) {
      itemLabelField.value = ''
      return true
    }

    if (!Object.prototype.hasOwnProperty.call(userConfigFields.value, normalized)) {
      return false
    }

    itemLabelField.value = normalized
    return true
  }

  function setMarkAsEditedBasis(nextFieldKey) {
    const normalized = String(nextFieldKey || '').trim()
    if (!normalized) {
      markAsEditedBasis.value = ''
      return true
    }

    if (!Object.prototype.hasOwnProperty.call(userConfigFields.value, normalized)) {
      return false
    }

    markAsEditedBasis.value = normalized
    return true
  }

  function startDrag(fieldKey) {
    draggedFieldKey.value = fieldKey
  }

  function dropAt(targetFieldKey) {
    if (!draggedFieldKey.value || draggedFieldKey.value === targetFieldKey) return
    const orderedKeys = sortedConfigFieldEntries.value.map(([key]) => key)
    const fromIndex = orderedKeys.indexOf(draggedFieldKey.value)
    const toIndex = orderedKeys.indexOf(targetFieldKey)
    if (fromIndex === -1 || toIndex === -1) return
    const [movedKey] = orderedKeys.splice(fromIndex, 1)
    orderedKeys.splice(toIndex, 0, movedKey)
    orderedKeys.forEach((key, index) => {
      userConfigFields.value[key].order = index
    })
    draggedFieldKey.value = ''
  }

  function endDrag() {
    draggedFieldKey.value = ''
  }

  function createUserConfigPayload() {
    normalizeCandidateTargets(userConfigFields.value)
    const normalizedFields = {}
    Object.keys(userConfigFields.value).forEach((key, index) => {
      normalizedFields[key] = normalizeUserConfigField(userConfigFields.value[key], index)
    })
    return {
      version: 1,
      fields: normalizedFields,
      itemLabelField: itemLabelField.value,
      markAsEditedBasis: markAsEditedBasis.value,
      showOnlyNonEmptyFields: showOnlyNonEmptyFields.value,
      hierarchyFields: normalizeStringArrayUnique(hierarchyFields.value),
      firstLevelStaticList: normalizeStringArrayUnique(firstLevelStaticList.value),
    }
  }

  function dropUnsupportedPrefill(field) {
    if (!supportsPrefill(field.type)) delete field.prefillWith
  }

  function setFieldType(fieldKey, nextType) {
    const field = userConfigFields.value[fieldKey]
    if (!field) return false

    field.type = nextType

    if (nextType === 'wikidata-autosuggest') {
      delete field.readOnly
      delete field.candidate
      if (!isPlainObject(field.autosuggest)) {
        field.autosuggest = createMinimalAutosuggestConfig()
      }
    } else if (nextType === 'candidate') {
      delete field.autosuggest
      if (typeof field.readOnly !== 'boolean') {
        field.readOnly = false
      }
      if (!isPlainObject(field.candidate)) {
        field.candidate = createMinimalCandidateConfig()
      }
      field.candidate.inputType = normalizeCandidateInputType(field.candidate.inputType)
      field.candidate.targetField = String(field.candidate.targetField || '').trim()
    } else {
      if (typeof field.readOnly !== 'boolean') {
        field.readOnly = false
      }
      delete field.autosuggest
      delete field.candidate
    }
    dropUnsupportedPrefill(field)

    normalizeCandidateTargets(userConfigFields.value)
    return true
  }

  function updateFieldCandidateConfig(fieldKey, nextCandidateConfig) {
    const field = userConfigFields.value[fieldKey]
    if (!field || field.type !== 'candidate') return false
    if (!isPlainObject(nextCandidateConfig)) return false

    const normalizedTargetField = String(nextCandidateConfig.targetField || '').trim()
    const normalizedInputType = normalizeCandidateInputType(nextCandidateConfig.inputType)
    const hasTarget = Boolean(normalizedTargetField)

    if (hasTarget) {
      if (normalizedTargetField === fieldKey) return false
      const targetConfig = userConfigFields.value[normalizedTargetField]
      if (!isPlainObject(targetConfig) || targetConfig.type === 'candidate') {
        return false
      }
    }

    field.candidate = {
      targetField: normalizedTargetField,
      inputType: normalizedInputType,
    }

    return true
  }

  function updateFieldAutosuggestConfig(fieldKey, nextAutosuggestConfig) {
    const field = userConfigFields.value[fieldKey]
    if (!field || field.type !== 'wikidata-autosuggest') return false
    if (!isPlainObject(nextAutosuggestConfig)) return false

    field.autosuggest = cloneValue(nextAutosuggestConfig)
    return true
  }

  function applyImportedConfigPayload(configPayload) {
    const validation = validateImportedConfigPayload(configPayload)
    if (!validation.ok) {
      return validation
    }

    const nextFields = {}
    Object.keys(configPayload.fields).forEach((key, index) => {
      if (!isConfigFieldAllowed(key)) return
      const source = configPayload.fields[key] || {}
      nextFields[key] = normalizeUserConfigField(source, index)
    })

    const requestedItemLabelField =
      typeof configPayload.itemLabelField === 'string' ? configPayload.itemLabelField.trim() : ''
    const normalizedItemLabelField =
      requestedItemLabelField && Object.prototype.hasOwnProperty.call(nextFields, requestedItemLabelField)
        ? requestedItemLabelField
        : ''

    const requestedMarkAsEditedBasis =
      typeof configPayload.markAsEditedBasis === 'string' ? configPayload.markAsEditedBasis.trim() : ''
    const normalizedMarkAsEditedBasis =
      requestedMarkAsEditedBasis && Object.prototype.hasOwnProperty.call(nextFields, requestedMarkAsEditedBasis)
        ? requestedMarkAsEditedBasis
        : ''
    const normalizedShowOnlyNonEmptyFields = Boolean(configPayload.showOnlyNonEmptyFields)
    // The same resolver as for the online settings, so a file and a settings record of the same
    // shape give the same hierarchy (review F6).
    const normalizedHierarchyFields = resolveHierarchyFieldsFromSettings(configPayload)
    const normalizedFirstLevelStaticList = resolveFirstLevelStaticList(configPayload)

    normalizeCandidateTargets(nextFields)

    userConfigFields.value = nextFields
    appliedUserConfigFields.value = JSON.parse(JSON.stringify(nextFields))
    normalizeCandidateTargets(appliedUserConfigFields.value)
    itemLabelField.value = normalizedItemLabelField
    appliedItemLabelField.value = normalizedItemLabelField
    markAsEditedBasis.value = normalizedMarkAsEditedBasis
    appliedMarkAsEditedBasis.value = normalizedMarkAsEditedBasis
    showOnlyNonEmptyFields.value = normalizedShowOnlyNonEmptyFields
    appliedShowOnlyNonEmptyFields.value = normalizedShowOnlyNonEmptyFields
    hierarchyFields.value = normalizedHierarchyFields
    appliedHierarchyFields.value = normalizedHierarchyFields
    firstLevelStaticList.value = normalizedFirstLevelStaticList
    appliedFirstLevelStaticList.value = normalizedFirstLevelStaticList
    appliedUserConfigSnapshot.value = serializeAppliedState()

    return { ok: true }
  }

  return {
    userConfigFields,
    sortedConfigFieldEntries,
    appliedUserConfigFields,
    itemLabelField,
    appliedItemLabelField,
    markAsEditedBasis,
    appliedMarkAsEditedBasis,
    showOnlyNonEmptyFields,
    appliedShowOnlyNonEmptyFields,
    hierarchyFields,
    appliedHierarchyFields,
    firstLevelStaticList,
    appliedFirstLevelStaticList,
    hasUnappliedUserConfigChanges,
    draggedFieldKey,
    isUserConfigOpen,
    newFieldName,
    addFieldError,
    initializeUserConfig,
    addUserConfigFieldsFromDataKeys,
    applyUserConfigToRawItems,
    addUserConfigField,
    setFieldType,
    updateFieldAutosuggestConfig,
    updateFieldCandidateConfig,
    setItemLabelField,
    setMarkAsEditedBasis,
    setShowOnlyNonEmptyFields,
    addHierarchyField,
    updateHierarchyFieldAt,
    removeHierarchyFieldAt,
    setFirstLevelStaticListFromText,
    removeUserConfigField,
    startDrag,
    dropAt,
    endDrag,
    createUserConfigPayload,
    applyImportedConfigPayload,
    validateImportedConfigPayload,
  }
}

export const PRIMARY_CONFIG_SCOPE = ''

const statesByScope = new Map()

/** The configuration state of `scope` (default: the primary collection), created on first use. */
export function useUserConfigStore(scope = PRIMARY_CONFIG_SCOPE) {
  const key = String(scope || '')
  if (!statesByScope.has(key)) statesByScope.set(key, createUserConfigState())
  return statesByScope.get(key)
}

/** Drops every secondary scope (when the data source closes or its collections change). */
export function clearSecondaryUserConfigScopes() {
  Array.from(statesByScope.keys())
    .filter((key) => key !== PRIMARY_CONFIG_SCOPE)
    .forEach((key) => statesByScope.delete(key))
}
