import { describe, expect, test } from 'vitest'
import {
  createDefaultValueForFieldType,
  createFieldEditorBinding,
  getRegisteredFieldTypes,
  normalizeUpdatedFieldValue,
  normalizeValueForConfiguredType,
  resolveFieldTypeForEditor,
} from './fieldRegistry'

describe('fieldRegistry', () => {
  test('keeps current registered field types', () => {
    expect(getRegisteredFieldTypes()).toEqual([
      'normal',
      'text',
      'integer',
      'checkbox',
      'candidate',
      'wikidata-autosuggest',
    ])
  })

  test('falls back to inferred editor type for unknown configured type', () => {
    expect(resolveFieldTypeForEditor('legacy-type', true)).toBe('checkbox')
    expect(resolveFieldTypeForEditor('legacy-type', 12)).toBe('integer')
    expect(resolveFieldTypeForEditor('legacy-type', 'abc')).toBe('normal')
  })

  test('creates checkbox editor binding', () => {
    const binding = createFieldEditorBinding({
      fieldId: 'field-enabled',
      configuredType: 'checkbox',
      value: true,
      placeholder: '',
      readOnly: true,
    })

    expect(binding.component).toBe('input')
    expect(binding.componentProps.type).toBe('checkbox')
    expect(binding.componentProps.checked).toBe(true)
    expect(binding.componentProps.disabled).toBe(true)
    expect(binding.eventName).toBe('change')
  })

  test('creates readonly text editor binding', () => {
    const binding = createFieldEditorBinding({
      fieldId: 'field-title',
      configuredType: 'normal',
      value: 'foo',
      placeholder: 'Title',
      readOnly: true,
    })

    expect(binding.component).toBe('input')
    expect(binding.componentProps.readonly).toBe(true)
  })

  test('uses expected defaults per field type', () => {
    expect(createDefaultValueForFieldType('checkbox')).toBe(false)
    expect(createDefaultValueForFieldType('candidate')).toBe('')
    expect(createDefaultValueForFieldType('wikidata-autosuggest')).toEqual([])
    expect(createDefaultValueForFieldType('text')).toBe('')
    expect(createDefaultValueForFieldType('integer')).toBe(null)
    expect(createDefaultValueForFieldType('unknown-type')).toBe('')
  })

  test('normalizes values during config apply as before', () => {
    expect(normalizeValueForConfiguredType('checkbox', 'true')).toBe(true)
    expect(normalizeValueForConfiguredType('checkbox', 'false')).toBe(false)
    expect(normalizeValueForConfiguredType('normal', true)).toBe('true')
    expect(normalizeValueForConfiguredType('candidate', false)).toBe('false')
  })

  test('creates candidate editor binding with configurable input mode', () => {
    const singleLine = createFieldEditorBinding({
      fieldId: 'field-candidate-one',
      configuredType: 'candidate',
      value: 'Oak',
      candidateConfig: { targetField: 'title', inputType: 'normal' },
    })

    expect(singleLine.component).toBe('input')
    expect(singleLine.componentProps.type).toBe('text')

    const multiline = createFieldEditorBinding({
      fieldId: 'field-candidate-two',
      configuredType: 'candidate',
      value: 'Oak\nBerlin',
      candidateConfig: { targetField: 'note', inputType: 'text' },
    })

    expect(multiline.component).toBe('textarea')
  })

  test('coerces integer values on config apply (best-effort, truncates floats, blanks -> null)', () => {
    // Canonical "no integer" representations all collapse to null.
    expect(normalizeValueForConfiguredType('integer', '')).toBe(null)
    expect(normalizeValueForConfiguredType('integer', '   ')).toBe(null)
    expect(normalizeValueForConfiguredType('integer', null)).toBe(null)
    expect(normalizeValueForConfiguredType('integer', undefined)).toBe(null)

    // Strings of digits are parsed to numbers.
    expect(normalizeValueForConfiguredType('integer', '12')).toBe(12)
    expect(normalizeValueForConfiguredType('integer', '-7')).toBe(-7)
    expect(normalizeValueForConfiguredType('integer', ' 42 ')).toBe(42)

    // Existing numbers pass through; floats are truncated (bulk apply is best-effort).
    expect(normalizeValueForConfiguredType('integer', 5)).toBe(5)
    expect(normalizeValueForConfiguredType('integer', 1.9)).toBe(1)
    expect(normalizeValueForConfiguredType('integer', -1.9)).toBe(-1)
    expect(normalizeValueForConfiguredType('integer', '1.5')).toBe(1)

    // Un-parseable input degrades to null rather than dropping through as a string.
    expect(normalizeValueForConfiguredType('integer', 'abc')).toBe(null)
    expect(normalizeValueForConfiguredType('integer', Number.NaN)).toBe(null)
    expect(normalizeValueForConfiguredType('integer', Number.POSITIVE_INFINITY)).toBe(null)

    // Booleans are not meaningful integers under the new type; they collapse to null.
    expect(normalizeValueForConfiguredType('integer', true)).toBe(null)
    expect(normalizeValueForConfiguredType('integer', false)).toBe(null)
  })

  test('normalizes malformed wikidata values to canonical array shape', () => {
    expect(normalizeValueForConfiguredType('wikidata-autosuggest', null)).toEqual([])
    expect(normalizeValueForConfiguredType('wikidata-autosuggest', 'Q42')).toEqual([{ id: 'Q42', label: 'Q42' }])
    expect(
      normalizeValueForConfiguredType('wikidata-autosuggest', {
        id: 'Q42',
        label: 'Douglas Adams',
        description: 'English writer',
      }),
    ).toEqual([{ id: 'Q42', label: 'Douglas Adams', description: 'English writer' }])
  })

  test('keeps autosuggest config as opaque pass-through in editor binding', () => {
    const autosuggestConfig = {
      searchLanguages: ['de', 'en'],
      prioritize: {
        claimPresence: {
          property: 'P31',
        },
      },
    }

    const binding = createFieldEditorBinding({
      fieldId: 'field-topic',
      configuredType: 'wikidata-autosuggest',
      value: [],
      autosuggestConfig,
      autosuggestPrefillValue: 'Douglas Adams',
    })

    expect(binding.component).toBe('ViewerWikidataField')
    expect(binding.componentProps.autosuggestConfig).toBe(autosuggestConfig)
    expect(binding.componentProps.prefillValue).toBe('Douglas Adams')
    expect(binding.resolvedType).toBe('wikidata-autosuggest')
  })

  test('normalizes updated values as before (legacy no-configuredType callers)', () => {
    // Legacy path: no configuredType provided. Behaviour keyed on typeof currentValue.
    expect(normalizeUpdatedFieldValue(5, '12')).toEqual({ ok: true, value: 12 })
    expect(normalizeUpdatedFieldValue(5, 'abc').ok).toBe(false)
    expect(normalizeUpdatedFieldValue(true, 0)).toEqual({ ok: true, value: false })
    expect(normalizeUpdatedFieldValue(null, '')).toEqual({ ok: true, value: null })
    expect(normalizeUpdatedFieldValue('text', 'next')).toEqual({ ok: true, value: 'next' })
  })

  test('integer edits are driven by configuredType, not by typeof currentValue', () => {
    // The problem this test guards against: with the default integer value of
    // null (or previously ''), typeof currentValue was not 'number', so string
    // edits were kept as-is and the field silently lost its integer type.

    // String digits -> number, regardless of currentValue's runtime type.
    expect(normalizeUpdatedFieldValue(null, '12', 'integer')).toEqual({ ok: true, value: 12 })
    expect(normalizeUpdatedFieldValue('', '42', 'integer')).toEqual({ ok: true, value: 42 })
    expect(normalizeUpdatedFieldValue(0, '7', 'integer')).toEqual({ ok: true, value: 7 })
    expect(normalizeUpdatedFieldValue(null, '-3', 'integer')).toEqual({ ok: true, value: -3 })

    // Empty string / whitespace -> null (canonical "no integer").
    expect(normalizeUpdatedFieldValue(5, '', 'integer')).toEqual({ ok: true, value: null })
    expect(normalizeUpdatedFieldValue(5, '   ', 'integer')).toEqual({ ok: true, value: null })
    expect(normalizeUpdatedFieldValue(5, null, 'integer')).toEqual({ ok: true, value: null })
    expect(normalizeUpdatedFieldValue(5, undefined, 'integer')).toEqual({ ok: true, value: null })

    // Non-integer numeric input is rejected (retain previous value).
    expect(normalizeUpdatedFieldValue(5, '1.5', 'integer')).toEqual({ ok: false, value: 5 })
    expect(normalizeUpdatedFieldValue(5, 1.5, 'integer')).toEqual({ ok: false, value: 5 })
    expect(normalizeUpdatedFieldValue(5, 'abc', 'integer')).toEqual({ ok: false, value: 5 })
    expect(normalizeUpdatedFieldValue(5, Number.NaN, 'integer')).toEqual({ ok: false, value: 5 })
    expect(normalizeUpdatedFieldValue(5, true, 'integer')).toEqual({ ok: false, value: 5 })

    // Pre-parsed numbers pass through when they are integers.
    expect(normalizeUpdatedFieldValue(null, 42, 'integer')).toEqual({ ok: true, value: 42 })
    expect(normalizeUpdatedFieldValue(null, -7, 'integer')).toEqual({ ok: true, value: -7 })
    expect(normalizeUpdatedFieldValue(null, 0, 'integer')).toEqual({ ok: true, value: 0 })
  })

  test('normalizes autosuggest updates and preserves metadata', () => {
    const nextValue = [
      { id: 'Q42', label: 'Douglas Adams', ranking: { score: 10 } },
      { id: 'Q42', label: 'Duplicate' },
    ]

    expect(normalizeUpdatedFieldValue([], nextValue, 'wikidata-autosuggest')).toEqual({
      ok: true,
      value: [{ id: 'Q42', label: 'Douglas Adams', ranking: { score: 10 } }],
    })
  })
})
