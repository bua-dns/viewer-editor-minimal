import { computed, ref } from 'vue'

const USER_CONFIG_SESSION_KEY = 'viewerEditor.userConfig.v1'

const userConfigFields = ref({})
const appliedUserConfigFields = ref({})
const appliedUserConfigSnapshot = ref('')
const draggedFieldKey = ref('')
const isUserConfigOpen = ref(false)
const newFieldName = ref('')
const addFieldError = ref('')

function serializeUserConfigFields(fields) {
  const normalized = {}
  Object.keys(fields)
    .sort()
    .forEach((key) => {
      normalized[key] = {
        type: fields[key]?.type || 'normal',
        label: fields[key]?.label || '',
        order: Number.isFinite(fields[key]?.order) ? fields[key].order : 0,
        placeholder: fields[key]?.placeholder || '',
      }
    })
  return JSON.stringify(normalized)
}

const sortedConfigFieldEntries = computed(() =>
  Object.entries(userConfigFields.value).sort((a, b) => (a[1].order || 0) - (b[1].order || 0)),
)

const hasUnappliedUserConfigChanges = computed(
  () => serializeUserConfigFields(userConfigFields.value) !== appliedUserConfigSnapshot.value,
)

function loadUserConfigFromSession() {
  try {
    const raw = sessionStorage.getItem(USER_CONFIG_SESSION_KEY)
    if (!raw) return { fields: {}, appliedFields: {} }
    const parsed = JSON.parse(raw)
    return {
      fields: parsed?.fields && typeof parsed.fields === 'object' ? parsed.fields : {},
      appliedFields:
        parsed?.appliedFields && typeof parsed.appliedFields === 'object' ? parsed.appliedFields : {},
    }
  } catch {
    return { fields: {}, appliedFields: {} }
  }
}

function persistUserConfigToSession() {
  const payload = {
    fields: userConfigFields.value,
    appliedFields: appliedUserConfigFields.value,
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
    appliedUserConfigSnapshot.value = ''
    return
  }

  const defaults = {}
  availableFieldKeys.forEach((key, index) => {
    defaults[key] = {
      type: 'normal',
      label: '',
      order: index,
      placeholder: '',
    }
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
    const defaultField = defaults[key] || {
      type: 'normal',
      label: '',
      order: Object.keys(nextFields).length,
      placeholder: '',
    }
    nextFields[key] = { ...defaultField, ...(persisted.fields[key] || {}) }
    nextAppliedFields[key] = {
      ...defaultField,
      ...(persisted.appliedFields[key] || persisted.fields[key] || {}),
    }
  })

  userConfigFields.value = nextFields
  appliedUserConfigFields.value = nextAppliedFields
  appliedUserConfigSnapshot.value = serializeUserConfigFields(nextAppliedFields)
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
        item[key] = config.type === 'checkbox' ? false : ''
      }
    })
  })

  rawItems.forEach((item) => {
    Object.keys(userConfigFields.value).forEach((key) => {
      const configuredType = userConfigFields.value[key]?.type || 'normal'
      const currentValue = item[key]
      if (configuredType !== 'checkbox' && typeof currentValue === 'boolean') {
        item[key] = String(currentValue)
      }
      if (configuredType === 'checkbox' && typeof currentValue === 'string') {
        const normalized = currentValue.trim().toLowerCase()
        if (normalized === 'true') item[key] = true
        if (normalized === 'false') item[key] = false
      }
    })
  })

  appliedUserConfigFields.value = JSON.parse(JSON.stringify(userConfigFields.value))
  appliedUserConfigSnapshot.value = serializeUserConfigFields(appliedUserConfigFields.value)
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

  userConfigFields.value[nextKey] = {
    type: 'normal',
    label: '',
    order: Object.keys(userConfigFields.value).length,
    placeholder: '',
  }
  newFieldName.value = ''
  persistUserConfigToSession()
}

function removeUserConfigField(fieldKey) {
  if (!Object.prototype.hasOwnProperty.call(userConfigFields.value, fieldKey)) return
  delete userConfigFields.value[fieldKey]
  persistUserConfigToSession()
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
  return { version: 1, fields: userConfigFields.value }
}

export function useUserConfigStore() {
  return {
    userConfigFields,
    sortedConfigFieldEntries,
    appliedUserConfigFields,
    hasUnappliedUserConfigChanges,
    draggedFieldKey,
    isUserConfigOpen,
    newFieldName,
    addFieldError,
    initializeUserConfig,
    clearUserConfigSession,
    applyUserConfigToRawItems,
    addUserConfigField,
    removeUserConfigField,
    startDrag,
    dropAt,
    endDrag,
    createUserConfigPayload,
  }
}
