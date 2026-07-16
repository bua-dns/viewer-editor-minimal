//src\stores\useUserConfigStore.js
import { computed, ref } from 'vue'
import { validateImportedConfigPayload } from '../composables/userConfigValidation'
import {
  createDefaultValueForFieldType,
  normalizeValueForConfiguredType,
} from '../fields/fieldRegistry'

const USER_CONFIG_SESSION_KEY = 'viewerEditor.userConfig.v1'

const userConfigFields = ref({})
const appliedUserConfigFields = ref({})
const itemLabelField = ref('')
const appliedItemLabelField = ref('')
const markAsEditedBasis = ref('')
const appliedMarkAsEditedBasis = ref('')
const showOnlyNonEmptyFields = ref(false)
const appliedShowOnlyNonEmptyFields = ref(false)
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

function createMinimalAutosuggestConfig() {
  return {
    minChars: 2,
    limit: 50,
  }
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

  return {
    type,
    label: source.label || '',
    order: Number.isFinite(source.order) ? source.order : fallbackOrder,
    placeholder: source.placeholder || '',
    hint: typeof source.hint === 'string' ? source.hint : '',
    ...(type !== 'wikidata-autosuggest' ? { readOnly } : {}),
    ...(autosuggest ? { autosuggest } : {}),
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
) {
  return JSON.stringify({
    fields: JSON.parse(serializeUserConfigFields(fields)),
    itemLabelField: String(nextItemLabelField || ''),
    markAsEditedBasis: String(nextMarkAsEditedBasis || ''),
    showOnlyNonEmptyFields: Boolean(nextShowOnlyNonEmptyFields),
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
    appliedUserConfigSnapshot.value = ''
    return
  }

  const defaults = {}
  availableFieldKeys.forEach((key, index) => {
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
  appliedUserConfigSnapshot.value = serializeUserConfigState(
    nextAppliedFields,
    appliedItemLabelField.value,
    appliedMarkAsEditedBasis.value,
    appliedShowOnlyNonEmptyFields.value,
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
  appliedUserConfigSnapshot.value = serializeUserConfigState(
    appliedUserConfigFields.value,
    appliedItemLabelField.value,
    appliedMarkAsEditedBasis.value,
    appliedShowOnlyNonEmptyFields.value,
  )
  persistUserConfigToSession()
}

function setShowOnlyNonEmptyFields(nextValue) {
  showOnlyNonEmptyFields.value = Boolean(nextValue)
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
  }
}

function setFieldType(fieldKey, nextType) {
  const field = userConfigFields.value[fieldKey]
  if (!field) return false

  field.type = nextType

  if (nextType === 'wikidata-autosuggest') {
    delete field.readOnly
    if (!isPlainObject(field.autosuggest)) {
      field.autosuggest = createMinimalAutosuggestConfig()
    }
  } else {
    if (typeof field.readOnly !== 'boolean') {
      field.readOnly = false
    }
    delete field.autosuggest
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

  userConfigFields.value = nextFields
  appliedUserConfigFields.value = JSON.parse(JSON.stringify(nextFields))
  itemLabelField.value = normalizedItemLabelField
  appliedItemLabelField.value = normalizedItemLabelField
  markAsEditedBasis.value = normalizedMarkAsEditedBasis
  appliedMarkAsEditedBasis.value = normalizedMarkAsEditedBasis
  showOnlyNonEmptyFields.value = normalizedShowOnlyNonEmptyFields
  appliedShowOnlyNonEmptyFields.value = normalizedShowOnlyNonEmptyFields
  appliedUserConfigSnapshot.value = serializeUserConfigState(
    appliedUserConfigFields.value,
    appliedItemLabelField.value,
    appliedMarkAsEditedBasis.value,
    appliedShowOnlyNonEmptyFields.value,
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
    setItemLabelField,
    setMarkAsEditedBasis,
    setShowOnlyNonEmptyFields,
    removeUserConfigField,
    startDrag,
    dropAt,
    endDrag,
    createUserConfigPayload,
    applyImportedConfigPayload,
    validateImportedConfigPayload,
  }
}
