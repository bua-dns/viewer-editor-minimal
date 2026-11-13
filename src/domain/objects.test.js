import { describe, expect, it } from 'vitest'
import { isPlainObject } from './objects'

describe('isPlainObject', () => {
  it('accepts objects', () => {
    expect(isPlainObject({})).toBe(true)
    expect(isPlainObject({ a: 1 })).toBe(true)
  })

  it('rejects null, arrays and primitives', () => {
    for (const value of [null, undefined, [], [1], 'x', 0, true]) {
      expect(isPlainObject(value)).toBe(false)
    }
  })
})
