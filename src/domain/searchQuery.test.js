import { describe, expect, test } from 'vitest'
import { isSearchQueryActive, tokenizeSearchQuery } from './searchQuery'

describe('searchQuery', () => {
  test('splits a query into lowercased tokens', () => {
    expect(tokenizeSearchQuery('  Alpha  beta  ')).toEqual(['alpha', 'beta'])
  })

  test('filters only from three characters on', () => {
    expect(isSearchQueryActive('ab')).toBe(false)
    expect(isSearchQueryActive('  ab  ')).toBe(false)
    expect(isSearchQueryActive('abc')).toBe(true)
    expect(tokenizeSearchQuery('ab')).toEqual([])
  })

  test('treats null and undefined as an empty query', () => {
    expect(tokenizeSearchQuery(null)).toEqual([])
    expect(isSearchQueryActive(undefined)).toBe(false)
  })
})
