import { describe, expect, test } from 'vitest'
import { findConflictingFields, isSameOnlineValue } from './onlineSaveConflicts'

describe('isSameOnlineValue', () => {
  test('treats all empty values as equal', () => {
    expect(isSameOnlineValue(null, '')).toBe(true)
    expect(isSameOnlineValue(undefined, [])).toBe(true)
    expect(isSameOnlineValue('', 'x')).toBe(false)
  })

  test('compares numbers with their string form and ignores object key order', () => {
    expect(isSameOnlineValue(5, '5')).toBe(true)
    expect(isSameOnlineValue([{ id: 'Q1', label: 'A' }], [{ label: 'A', id: 'Q1' }])).toBe(true)
    expect(isSameOnlineValue([{ id: 'Q1' }], [{ id: 'Q2' }])).toBe(false)
  })

  test('keeps false distinct from empty', () => {
    expect(isSameOnlineValue(false, null)).toBe(false)
    expect(isSameOnlineValue(false, false)).toBe(true)
  })
})

describe('findConflictingFields', () => {
  const sentFields = { label: 'Mine', year: 1900 }

  test('reports fields whose server value matches neither baseline nor the sent value', () => {
    const conflicts = findConflictingFields({
      sentFields,
      baselineFields: { label: 'Old', year: 1890 },
      serverItem: { label: 'Theirs', year: 1890 },
    })
    expect(conflicts).toEqual(['label'])
  })

  test('accepts a server value that already equals the sent value', () => {
    const conflicts = findConflictingFields({
      sentFields,
      baselineFields: { label: 'Old', year: 1890 },
      serverItem: { label: 'Mine', year: '1900' },
    })
    expect(conflicts).toEqual([])
  })

  test('skips fields without baseline or without server value', () => {
    const conflicts = findConflictingFields({
      sentFields,
      baselineFields: { label: 'Old' },
      serverItem: { year: 1850 },
    })
    expect(conflicts).toEqual([])
  })
})
