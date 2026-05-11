import { describe, expect, test } from 'vitest'
import { validateImportedConfigPayload } from './userConfigValidation'

describe('validateImportedConfigPayload', () => {
  test('accepts valid payload', () => {
    const result = validateImportedConfigPayload({
      fields: {
        species: {
          type: 'normal',
          label: '',
          order: 0,
          placeholder: '',
        },
      },
    })
    expect(result.ok).toBe(true)
  })

  test('rejects missing fields object', () => {
    const result = validateImportedConfigPayload({ version: 1 })
    expect(result.ok).toBe(false)
  })

  test('rejects invalid field type', () => {
    const result = validateImportedConfigPayload({
      fields: {
        species: {
          type: 'date',
        },
      },
    })
    expect(result.ok).toBe(false)
  })
})
