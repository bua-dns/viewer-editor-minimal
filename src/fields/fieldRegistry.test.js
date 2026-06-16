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
    expect(getRegisteredFieldTypes()).toEqual(['normal', 'text', 'integer', 'checkbox'])
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
    expect(createDefaultValueForFieldType('text')).toBe('')
    expect(createDefaultValueForFieldType('unknown-type')).toBe('')
  })

  test('normalizes values during config apply as before', () => {
    expect(normalizeValueForConfiguredType('checkbox', 'true')).toBe(true)
    expect(normalizeValueForConfiguredType('checkbox', 'false')).toBe(false)
    expect(normalizeValueForConfiguredType('normal', true)).toBe('true')
    expect(normalizeValueForConfiguredType('integer', false)).toBe('false')
  })

  test('normalizes updated values as before', () => {
    expect(normalizeUpdatedFieldValue(5, '12')).toEqual({ ok: true, value: 12 })
    expect(normalizeUpdatedFieldValue(5, 'abc').ok).toBe(false)
    expect(normalizeUpdatedFieldValue(true, 0)).toEqual({ ok: true, value: false })
    expect(normalizeUpdatedFieldValue(null, '')).toEqual({ ok: true, value: null })
    expect(normalizeUpdatedFieldValue('text', 'next')).toEqual({ ok: true, value: 'next' })
  })
})
