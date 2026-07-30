//src\stores\useUserConfigStore.js
import { computed, ref } from 'vue'
import { validateImportedConfigPayload } from '../composables/userConfigValidation'
import {
  createDefaultValueForFieldType,
  normalizeValueForConfiguredType,
} from '../fields/fieldRegistry'

const USER_CONFIG_SESSION_KEY = 'viewerEditor.userConfig.v1'
const EXCLUDED_CONFIG_FIELD_KEYS = new Set(['scan', 'suspendEditing', '__onlineMeta'])

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

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
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

function resolveHierarchyFieldsFromConfig(configPayload) {
  const candidateArrays = [
    configPayload?.hierarchyFields,
    configPayload?.hierarchy_fields,
    configPayload?.hierarchicalFields,
    configPayload?.hierarchy?.fields,
  ]

  let source = candidateArrays.find((entry) => Array.isArray(entry)) || []

  if (!source.length) {
    const stringCandidate = [
      configPayload?.hierarchyFields,
      configPayload?.hierarchy_fields,
      configPayload?.hierarchicalFields,
    ].find((entry) => typeof entry === 'string' && entry.trim())

    if (stringCandidate) {
      source = stringCandidate.split(',')
    }
  }

  if (!source.length) {
    const hierarchyObject =
      configPayload?.hierarchy &&
      typeof configPayload.hierarchy === 'object' &&
      !Array.isArray(configPayload.hierarchy)
        ? configPayload.hierarchy
        : null

    if (hierarchyObject) {
      const level1 = String(hierarchyObject.level1 || hierarchyObject.level_1 || '').trim()
      const level2 = String(hierarchyObject.level2 || hierarchyObject.level_2 || '').trim()
      if (level1 && level2) {
        source = [level1, level2]
      }
    }
  }

  return normalizeStringArrayUnique(source)
}

function resolveFirstLevelStaticListFromConfig(configPayload) {
  const candidateArrays = [
    configPayload?.firstLevelStaticList,
    configPayload?.first_level_static_list,
    configPayload?.hierarchy?.firstLevelStaticList,
  ]
  const source = candidateArrays.find((entry) => Array.isArray(entry)) || []
  return normalizeStringArrayUnique(source)
}

function normalizeUserConfigField(source = {}, fallbackOrder = 0) {
  const type = source.type || 'normal'
  const readOnly = type !== 'wikidata-autosuggest' ? Boolean(source.readOnly) : undefined
  const autosuggest =
    type === 'wikidata-autosuggest' && isPlainObject(source.autosuggest)
      ? cloneValue(source.autosuggest)
      : type === 'wikidata-autosuggest'
      ? createMinimalAutosuggestConfig()
      : undefined
  const candidate =
    type === 'candidate' && isPlainObject(source.candidate)
      ? cloneValue(source.candidate)
      : type === 'candidate'
        ? createMinimalCandidateConfig()
        : undefined

  if (isPlainObject(autosuggest)) {
    if (typeof autosuggest.prefillWith === 'string') {
      const normalizedPrefillWith = autosuggest.prefillWith.trim()
      if (normalizedPrefillWith) {
        autosuggest.prefillWith = normalizedPrefillWith
      } else {
        delete autosuggest.prefillWith
      }
    } else {
      delete autosuggest.prefillWith
    }
  }

  if (isPlainObject(candidate)) {
    candidate.targetField = String(candidate.targetField || '').trim()
    candidate.inputType = normalizeCandidateInputType(candidate.inputType)
  }

  return {
    type,
    label: source.label || '',
    order: Number.isFinite(source.order) ? source.order : fallbackOrder,
    placeholder: source.placeholder || '',
    hint: typeof source.hint === 'string' ? source.hint : '',
    ...(type !== 'wikidata-autosuggest' ? { readOnly } : {}),
    ...(autosuggest ? { autosuggest } : {}),
    ...(candidate ? { candidate } : {}),
  }
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

function serializeUserConfigState(
  fields,
  nextItemLabelField,
  nextMarkAsEditedBasis,
  nextShowOnlyNonEmptyFields,
  nextHierarchyFields,
  nextFirstLevelStaticList,
) {
  return JSON.stringify({
    fields: JSON.parse(serializeUserConfigFields(fields)),
    itemLabelField: String(nextItemLabelField || ''),
    markAsEditedBasis: String(nextMarkAsEditedBasis || ''),
    showOnlyNonEmptyFields: Boolean(nextShowOnlyNonEmptyFields),
    hierarchyFields: normalizeStringArrayUnique(nextHierarchyFields),
    firstLevelStaticList: normalizeStringArrayUnique(nextFirstLevelStaticList),
  })
}

const sortedConfigFieldEntries = computed(() =>
  Object.entries(userConfigFields.value).sort((a, b) => (a[1].order || 0) - (b[1].order || 0)),
)

const hasUnappliedUserConfigChanges = computed(
  () =>
    serializeUserConfigState(
      userConfigFields.value,
      itemLabelField.value,
      markAsEditedBasis.value,
      showOnlyNonEmptyFields.value,
      hierarchyFields.value,
      firstLevelStaticList.value,
    ) !== appliedUserConfigSnapshot.value,
)

function loadUserConfigFromSession() {
  try {
    const raw = sessionStorage.getItem(USER_CONFIG_SESSION_KEY)
    if (!raw) {
      return {
        fields: {},
        appliedFields: {},
        itemLabelField: '',
        appliedItemLabelField: '',
        markAsEditedBasis: '',
        appliedMarkAsEditedBasis: '',
        showOnlyNonEmptyFields: false,
        appliedShowOnlyNonEmptyFields: false,
        hierarchyFields: [],
        appliedHierarchyFields: [],
        firstLevelStaticList: [],
        appliedFirstLevelStaticList: [],
      }
    }
    const parsed = JSON.parse(raw)
    return {
      fields: parsed?.fields && typeof parsed.fields === 'object' ? parsed.fields : {},
      appliedFields:
        parsed?.appliedFields && typeof parsed.appliedFields === 'object' ? parsed.appliedFields : {},
      itemLabelField: typeof parsed?.itemLabelField === 'string' ? parsed.itemLabelField : '',
      appliedItemLabelField:
        typeof parsed?.appliedItemLabelField === 'string'
          ? parsed.appliedItemLabelField
          : typeof parsed?.itemLabelField === 'string'
            ? parsed.itemLabelField
            : '',
      markAsEditedBasis: typeof parsed?.markAsEditedBasis === 'string' ? parsed.markAsEditedBasis : '',
      appliedMarkAsEditedBasis:
        typeof parsed?.appliedMarkAsEditedBasis === 'string'
          ? parsed.appliedMarkAsEditedBasis
          : typeof parsed?.markAsEditedBasis === 'string'
            ? parsed.markAsEditedBasis
            : '',
      showOnlyNonEmptyFields: Boolean(parsed?.showOnlyNonEmptyFields),
      appliedShowOnlyNonEmptyFields:
        typeof parsed?.appliedShowOnlyNonEmptyFields === 'boolean'
          ? parsed.appliedShowOnlyNonEmptyFields
          : Boolean(parsed?.showOnlyNonEmptyFields),
      hierarchyFields: normalizeStringArrayUnique(parsed?.hierarchyFields),
      appliedHierarchyFields: normalizeStringArrayUnique(
        Array.isArray(parsed?.appliedHierarchyFields) ? parsed.appliedHierarchyFields : parsed?.hierarchyFields,
      ),
      firstLevelStaticList: normalizeStringArrayUnique(parsed?.firstLevelStaticList),
      appliedFirstLevelStaticList: normalizeStringArrayUnique(
        Array.isArray(parsed?.appliedFirstLevelStaticList)
          ? parsed.appliedFirstLevelStaticList
          : parsed?.firstLevelStaticList,
      ),
    }
  } catch {
    return {
      fields: {},
      appliedFields: {},
      itemLabelField: '',
      appliedItemLabelField: '',
      markAsEditedBasis: '',
      appliedMarkAsEditedBasis: '',
      showOnlyNonEmptyFields: false,
      appliedShowOnlyNonEmptyFields: false,
      hierarchyFields: [],
      appliedHierarchyFields: [],
      firstLevelStaticList: [],
      appliedFirstLevelStaticList: [],
    }
  }
}

function persistUserConfigToSession() {
  const payload = {
    fields: userConfigFields.value,
    appliedFields: appliedUserConfigFields.value,
    itemLabelField: itemLabelField.value,
    appliedItemLabelField: appliedItemLabelField.value,
    markAsEditedBasis: markAsEditedBasis.value,
    appliedMarkAsEditedBasis: appliedMarkAsEditedBasis.value,
    showOnlyNonEmptyFields: showOnlyNonEmptyFields.value,
    appliedShowOnlyNonEmptyFields: appliedShowOnlyNonEmptyFields.value,
    hierarchyFields: hierarchyFields.value,
    appliedHierarchyFields: appliedHierarchyFields.value,
    firstLevelStaticList: firstLevelStaticList.value,
    appliedFirstLevelStaticList: appliedFirstLevelStaticList.value,
  }
  sessionStorage.setItem(USER_CONFIG_SESSION_KEY, JSON.stringify(payload))
}

function clearUserConfigSession() {
  sessionStorage.removeItem(USER_CONFIG_SESSION_KEY)
}

function initializeUserConfig(availableFieldKeys, hasData) {
  if (!hasData) {
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
    appliedUserConfigSnapshot.value = ''
    return
  }

  const defaults = {}
  availableFieldKeys.forEach((key, index) => {
    if (!isConfigFieldAllowed(key)) return
    defaults[key] = normalizeUserConfigField({}, index)
  })

  const persisted = loadUserConfigFromSession()
  const nextFields = {}
  const nextAppliedFields = {}
  const allKeys = new Set([
    ...Object.keys(defaults),
    ...Object.keys(persisted.fields || {}),
    ...Object.keys(persisted.appliedFields || {}),
  ])

  Array.from(allKeys).forEach((key) => {
    if (!isConfigFieldAllowed(key)) return
    const defaultField = defaults[key] || normalizeUserConfigField({}, Object.keys(nextFields).length)
    nextFields[key] = normalizeUserConfigField(
      { ...defaultField, ...(persisted.fields[key] || {}) },
      defaultField.order,
    )
    nextAppliedFields[key] = normalizeUserConfigField(
      { ...defaultField, ...(persisted.appliedFields[key] || persisted.fields[key] || {}) },
      defaultField.order,
    )
  })

  userConfigFields.value = nextFields
  appliedUserConfigFields.value = nextAppliedFields
  normalizeCandidateTargets(userConfigFields.value)
  normalizeCandidateTargets(appliedUserConfigFields.value)
  const hasLabelField = Object.prototype.hasOwnProperty.call(nextFields, persisted.itemLabelField)
  const hasAppliedLabelField = Object.prototype.hasOwnProperty.call(nextFields, persisted.appliedItemLabelField)
  const hasEditedBasisField = Object.prototype.hasOwnProperty.call(nextFields, persisted.markAsEditedBasis)
  const hasAppliedEditedBasisField = Object.prototype.hasOwnProperty.call(
    nextFields,
    persisted.appliedMarkAsEditedBasis,
  )
  itemLabelField.value = hasLabelField ? persisted.itemLabelField : ''
  appliedItemLabelField.value = hasAppliedLabelField ? persisted.appliedItemLabelField : itemLabelField.value
  markAsEditedBasis.value = hasEditedBasisField ? persisted.markAsEditedBasis : ''
  appliedMarkAsEditedBasis.value = hasAppliedEditedBasisField
    ? persisted.appliedMarkAsEditedBasis
    : markAsEditedBasis.value
  showOnlyNonEmptyFields.value = persisted.showOnlyNonEmptyFields
  appliedShowOnlyNonEmptyFields.value = persisted.appliedShowOnlyNonEmptyFields
  hierarchyFields.value = normalizeStringArrayUnique(persisted.hierarchyFields)
  appliedHierarchyFields.value = normalizeStringArrayUnique(persisted.appliedHierarchyFields)
  firstLevelStaticList.value = normalizeStringArrayUnique(persisted.firstLevelStaticList)
  appliedFirstLevelStaticList.value = normalizeStringArrayUnique(persisted.appliedFirstLevelStaticList)
  appliedUserConfigSnapshot.value = serializeUserConfigState(
    nextAppliedFields,
    appliedItemLabelField.value,
    appliedMarkAsEditedBasis.value,
    appliedShowOnlyNonEmptyFields.value,
    appliedHierarchyFields.value,
    appliedFirstLevelStaticList.value,
  )
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
  appliedUserConfigSnapshot.value = serializeUserConfigState(
    appliedUserConfigFields.value,
    appliedItemLabelField.value,
    appliedMarkAsEditedBasis.value,
    appliedShowOnlyNonEmptyFields.value,
    appliedHierarchyFields.value,
    appliedFirstLevelStaticList.value,
  )
  persistUserConfigToSession()
}

function setShowOnlyNonEmptyFields(nextValue) {
  showOnlyNonEmptyFields.value = Boolean(nextValue)
  persistUserConfigToSession()
}

function addHierarchyField() {
  hierarchyFields.value = [...hierarchyFields.value, '']
  persistUserConfigToSession()
}

function updateHierarchyFieldAt(index, nextValue) {
  if (!Number.isInteger(index) || index < 0 || index >= hierarchyFields.value.length) return false
  const nextHierarchyFields = [...hierarchyFields.value]
  nextHierarchyFields[index] = String(nextValue || '').trim()
  hierarchyFields.value = nextHierarchyFields
  persistUserConfigToSession()
  return true
}

function removeHierarchyFieldAt(index) {
  if (!Number.isInteger(index) || index < 0 || index >= hierarchyFields.value.length) return false
  hierarchyFields.value = hierarchyFields.value.filter((_, currentIndex) => currentIndex !== index)
  persistUserConfigToSession()
  return true
}

function setFirstLevelStaticListFromText(nextValue) {
  const tokens = String(nextValue || '')
    .split(/[\n,]/)
    .map((entry) => String(entry || '').trim())
    .filter(Boolean)
  firstLevelStaticList.value = normalizeStringArrayUnique(tokens)
  persistUserConfigToSession()
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
  persistUserConfigToSession()
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
  persistUserConfigToSession()
}

function setItemLabelField(nextFieldKey) {
  const normalized = String(nextFieldKey || '').trim()
  if (!normalized) {
    itemLabelField.value = ''
    persistUserConfigToSession()
    return true
  }

  if (!Object.prototype.hasOwnProperty.call(userConfigFields.value, normalized)) {
    return false
  }

  itemLabelField.value = normalized
  persistUserConfigToSession()
  return true
}

function setMarkAsEditedBasis(nextFieldKey) {
  const normalized = String(nextFieldKey || '').trim()
  if (!normalized) {
    markAsEditedBasis.value = ''
    persistUserConfigToSession()
    return true
  }

  if (!Object.prototype.hasOwnProperty.call(userConfigFields.value, normalized)) {
    return false
  }

  markAsEditedBasis.value = normalized
  persistUserConfigToSession()
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
  persistUserConfigToSession()
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

  normalizeCandidateTargets(userConfigFields.value)
  persistUserConfigToSession()
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

  persistUserConfigToSession()
  return true
}

function updateFieldAutosuggestConfig(fieldKey, nextAutosuggestConfig) {
  const field = userConfigFields.value[fieldKey]
  if (!field || field.type !== 'wikidata-autosuggest') return false
  if (!isPlainObject(nextAutosuggestConfig)) return false

  field.autosuggest = cloneValue(nextAutosuggestConfig)
  persistUserConfigToSession()
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
  const normalizedHierarchyFields = resolveHierarchyFieldsFromConfig(configPayload)
  const normalizedFirstLevelStaticList = resolveFirstLevelStaticListFromConfig(configPayload)

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
  appliedUserConfigSnapshot.value = serializeUserConfigState(
    appliedUserConfigFields.value,
    appliedItemLabelField.value,
    appliedMarkAsEditedBasis.value,
    appliedShowOnlyNonEmptyFields.value,
    appliedHierarchyFields.value,
    appliedFirstLevelStaticList.value,
  )
  persistUserConfigToSession()

  return { ok: true }
}

export function useUserConfigStore() {
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
    clearUserConfigSession,
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
