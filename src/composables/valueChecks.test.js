import { describe, expect, test } from 'vitest'
import { hasNonEmptyValue } from './valueChecks'

describe('hasNonEmptyValue', () => {
  test('treats blank strings, empty arrays and empty objects as empty', () => {
    expect([null, undefined, '', '   ', [], {}].map(hasNonEmptyValue)).toEqual([false, false, false, false, false, false])
  })

  test('treats other values as filled, including false and 0', () => {
    expect(['x', ['a'], { a: 1 }, 0, false].map(hasNonEmptyValue)).toEqual([true, true, true, true, true])
  })
})
