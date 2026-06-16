import { normalizeWikidataAutosuggestValue } from './wikidataAutosuggestField'

const FALLBACK_FIELD_TYPE = 'normal'

function toDomValue(value) {
  return value === null ? '' : value
}

function createTextInputBinding({ fieldId, value, placeholder, inputType = 'text' }) {
  return {
    component: 'input',
    componentProps: {
      id: fieldId,
      type: inputType,
      placeholder,
      value: toDomValue(value),
    },
    eventName: 'input',
    readEventValue(event) {
      return event.target.value
    },
  }
}

function createTextareaBinding({ fieldId, value, placeholder }) {
  return {
    component: 'textarea',
    componentProps: {
      id: fieldId,
      placeholder,
      value: toDomValue(value),
    },
    eventName: 'input',
    readEventValue(event) {
      return event.target.value
    },
  }
}

function createCheckboxBinding({ fieldId, value }) {
  return {
    component: 'input',
    componentProps: {
      id: fieldId,
      type: 'checkbox',
      checked: Boolean(value),
    },
    eventName: 'change',
    readEventValue(event) {
      return event.target.checked
    },
  }
}

function normalizeNonCheckboxValueForConfigApply(currentValue) {
  if (typeof currentValue === 'boolean') {
    return String(currentValue)
  }
  return currentValue
}

const FIELD_REGISTRY = Object.freeze({
  normal: {
    key: 'normal',
    labelKey: 'configTypeNormal',
    labelFallback: 'normal (string)',
    createEditorBinding: createTextInputBinding,
    createDefaultValue() {
      return ''
    },
    normalizeValueForConfigApply: normalizeNonCheckboxValueForConfigApply,
  },
  text: {
    key: 'text',
    labelKey: 'configTypeText',
    labelFallback: 'Textfeld (text)',
    createEditorBinding: createTextareaBinding,
    createDefaultValue() {
      return ''
    },
    normalizeValueForConfigApply: normalizeNonCheckboxValueForConfigApply,
  },
  integer: {
    key: 'integer',
    labelKey: 'configTypeInteger',
    labelFallback: 'Zahl (integer)',
    createEditorBinding(context) {
      return createTextInputBinding({ ...context, inputType: 'number' })
    },
    createDefaultValue() {
      return ''
    },
    normalizeValueForConfigApply: normalizeNonCheckboxValueForConfigApply,
  },
  checkbox: {
    key: 'checkbox',
    labelKey: 'configTypeCheckbox',
    labelFallback: 'Ja/Nein (checkbox)',
    createEditorBinding: createCheckboxBinding,
    createDefaultValue() {
      return false
    },
    normalizeValueForConfigApply(currentValue) {
      if (typeof currentValue !== 'string') {
        return currentValue
      }

      const normalized = currentValue.trim().toLowerCase()
      if (normalized === 'true') return true
      if (normalized === 'false') return false
      return currentValue
    },
  },
  'wikidata-autosuggest': {
    key: 'wikidata-autosuggest',
    labelKey: 'configTypeWikidataAutosuggest',
    labelFallback: 'Wikidata Autosuggest',
    createEditorBinding({ fieldId, value, placeholder, autosuggestConfig }) {
      return {
        component: 'ViewerWikidataField',
        componentProps: {
          fieldId,
          modelValue: value,
          placeholder,
          autosuggestConfig,
        },
        eventName: 'update:modelValue',
        readEventValue(nextValue) {
          return nextValue
        },
      }
    },
    createDefaultValue() {
      return []
    },
    normalizeValueForConfigApply(currentValue) {
      return normalizeWikidataAutosuggestValue(currentValue)
    },
  },
})

const REGISTERED_FIELD_TYPES = Object.freeze(Object.keys(FIELD_REGISTRY))

function inferFieldTypeFromValue(value) {
  if (typeof value === 'number') return 'integer'
  if (typeof value === 'boolean') return 'checkbox'
  return FALLBACK_FIELD_TYPE
}

export function hasRegisteredFieldType(type) {
  return Object.prototype.hasOwnProperty.call(FIELD_REGISTRY, type)
}

export function getRegisteredFieldTypes() {
  return REGISTERED_FIELD_TYPES
}

export function getRegisteredFieldTypeOptions() {
  return REGISTERED_FIELD_TYPES.map((key) => {
    const definition = FIELD_REGISTRY[key]
    return {
      value: definition.key,
      labelKey: definition.labelKey,
      labelFallback: definition.labelFallback,
    }
  })
}

export function resolveConfiguredFieldType(type) {
  return hasRegisteredFieldType(type) ? type : FALLBACK_FIELD_TYPE
}

export function resolveFieldTypeForEditor(configuredType, value) {
  if (hasRegisteredFieldType(configuredType)) {
    return configuredType
  }
  return inferFieldTypeFromValue(value)
}

export function createFieldEditorBinding({
  fieldId,
  configuredType,
  value,
  placeholder = '',
  autosuggestConfig = null,
}) {
  const resolvedType = resolveFieldTypeForEditor(configuredType, value)
  const definition = FIELD_REGISTRY[resolvedType]
  const binding = definition.createEditorBinding({ fieldId, value, placeholder, autosuggestConfig })
  return {
    ...binding,
    resolvedType,
  }
}

export function createDefaultValueForFieldType(configuredType) {
  const resolvedType = resolveConfiguredFieldType(configuredType)
  return FIELD_REGISTRY[resolvedType].createDefaultValue()
}

export function normalizeValueForConfiguredType(configuredType, currentValue) {
  const resolvedType = resolveConfiguredFieldType(configuredType)
  return FIELD_REGISTRY[resolvedType].normalizeValueForConfigApply(currentValue)
}

export function normalizeUpdatedFieldValue(currentValue, nextRawValue, configuredType = null) {
  const resolvedType = resolveConfiguredFieldType(configuredType)

  if (resolvedType === 'wikidata-autosuggest') {
    return { ok: true, value: normalizeWikidataAutosuggestValue(nextRawValue) }
  }

  if (typeof currentValue === 'number') {
    const parsedNumber = Number(nextRawValue)
    if (Number.isNaN(parsedNumber)) {
      return { ok: false, value: currentValue }
    }
    return { ok: true, value: parsedNumber }
  }

  if (typeof currentValue === 'boolean') {
    return { ok: true, value: Boolean(nextRawValue) }
  }

  if (currentValue === null) {
    return { ok: true, value: nextRawValue === '' ? null : nextRawValue }
  }

  return { ok: true, value: nextRawValue }
}
