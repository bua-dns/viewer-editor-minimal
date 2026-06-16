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
    })

    expect(binding.component).toBe('input')
    expect(binding.componentProps.type).toBe('checkbox')
    expect(binding.componentProps.checked).toBe(true)
    expect(binding.eventName).toBe('change')
  })

  test('uses expected defaults per field type', () => {
    expect(createDefaultValueForFieldType('checkbox')).toBe(false)
    expect(createDefaultValueForFieldType('wikidata-autosuggest')).toEqual([])
    expect(createDefaultValueForFieldType('text')).toBe('')
    expect(createDefaultValueForFieldType('unknown-type')).toBe('')
  })

  test('normalizes values during config apply as before', () => {
    expect(normalizeValueForConfiguredType('checkbox', 'true')).toBe(true)
    expect(normalizeValueForConfiguredType('checkbox', 'false')).toBe(false)
    expect(normalizeValueForConfiguredType('normal', true)).toBe('true')
    expect(normalizeValueForConfiguredType('integer', false)).toBe('false')
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
    })

    expect(binding.component).toBe('ViewerWikidataField')
    expect(binding.componentProps.autosuggestConfig).toBe(autosuggestConfig)
    expect(binding.resolvedType).toBe('wikidata-autosuggest')
  })

  test('normalizes updated values as before', () => {
    expect(normalizeUpdatedFieldValue(5, '12')).toEqual({ ok: true, value: 12 })
    expect(normalizeUpdatedFieldValue(5, 'abc').ok).toBe(false)
    expect(normalizeUpdatedFieldValue(true, 0)).toEqual({ ok: true, value: false })
    expect(normalizeUpdatedFieldValue(null, '')).toEqual({ ok: true, value: null })
    expect(normalizeUpdatedFieldValue('text', 'next')).toEqual({ ok: true, value: 'next' })
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
