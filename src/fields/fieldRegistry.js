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

/**
 * Integer normalization helpers.
 *
 * Canonical "no integer" representation is `null`. The following inputs all
 * map to `null` at the storage layer:
 *   - `null`
 *   - `undefined`
 *   - the empty string `''`
 *   - whitespace-only strings
 * This keeps the on-disk shape unambiguous: an integer field either holds
 * a `number` or a `null` (never an empty string, never a numeric string).
 *
 * Per-edit vs. bulk-apply have different tolerance for garbage:
 *   - `coerceIntegerForEdit` REJECTS non-integer numeric input (e.g. "1.5",
 *     "abc") so the UI can flag the edit as invalid via `updateField`'s
 *     existing `ok: false` path.
 *   - `coerceIntegerForConfigApply` is best-effort: it accepts floats and
 *     truncates them (`Math.trunc`), and falls back to `null` for
 *     un-parseable strings. Bulk normalization has no interactive retry,
 *     so silent recovery is preferable to data loss beyond what is
 *     unavoidable.
 */

function isBlankIntegerInput(value) {
  if (value === null || value === undefined) return true
  if (typeof value === 'string' && value.trim() === '') return true
  return false
}

function coerceIntegerForEdit(value) {
  if (isBlankIntegerInput(value)) {
    return { ok: true, value: null }
  }

  if (typeof value === 'boolean') {
    // Booleans are not valid integer edits; treat as invalid.
    return { ok: false }
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value) || !Number.isInteger(value)) {
      return { ok: false }
    }
    return { ok: true, value }
  }

  if (typeof value === 'string') {
    // `Number('  12  ')` yields 12; `Number('1.5')` yields 1.5; `Number('abc')` yields NaN.
    const parsed = Number(value)
    if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
      return { ok: false }
    }
    return { ok: true, value: parsed }
  }

  return { ok: false }
}

function coerceIntegerForConfigApply(value) {
  if (isBlankIntegerInput(value)) {
    return null
  }

  if (typeof value === 'boolean') {
    // Preserve boolean-as-boolean semantics would defeat the type change;
    // bulk apply reinterprets the field as integer, so booleans become null.
    return null
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return null
    return Math.trunc(value)
  }

  if (typeof value === 'string') {
    const parsed = Number(value)
    if (!Number.isFinite(parsed)) return null
    return Math.trunc(parsed)
  }

  return null
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
      // `null` is the canonical "no integer" value — see integer normalization
      // helpers above. An empty string here would re-introduce the string/number
      // ambiguity that item 1 of the 2026-07-06 refactor closes.
      return null
    },
    normalizeValueForConfigApply: coerceIntegerForConfigApply,
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

  // Item 1 (refactor 2026-07-06): coercion is driven by the CONFIGURED type,
  // not by `typeof currentValue`. Previously, an integer field whose current
  // value was still the default `''` would silently retain string edits,
  // breaking integer semantics on export.
  if (resolvedType === 'integer') {
    const coerced = coerceIntegerForEdit(nextRawValue)
    if (!coerced.ok) {
      return { ok: false, value: currentValue }
    }
    return { ok: true, value: coerced.value }
  }

  // Legacy fallback: when no configuredType is supplied and the current value
  // is a number, keep the previous numeric-coercion behaviour so callers that
  // have not yet been migrated to pass `configuredType` still work.
  if (configuredType === null && typeof currentValue === 'number') {
    const parsedNumber = Number(nextRawValue)
    if (!Number.isFinite(parsedNumber)) {
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
