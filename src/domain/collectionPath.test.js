import { describe, expect, it } from 'vitest'
import { normalizeCollectionPath, sameCollectionPath } from './collectionPath'

describe('normalizeCollectionPath', () => {
  it('strips query, fragment, trailing slashes and whitespace', () => {
    expect(normalizeCollectionPath(' /api/items?x=1#top/ ')).toBe('/api/items')
    expect(normalizeCollectionPath('/api/items#a?b')).toBe('/api/items')
    expect(normalizeCollectionPath('/api/items///')).toBe('/api/items')
  })

  it('returns an empty string for non-strings', () => {
    expect(normalizeCollectionPath(null)).toBe('')
    expect(normalizeCollectionPath(undefined)).toBe('')
    expect(normalizeCollectionPath(42)).toBe('')
  })
})

describe('sameCollectionPath', () => {
  it('treats query, fragment and trailing slash variants as equal', () => {
    expect(sameCollectionPath('/api/items', '/api/items/?populate=*')).toBe(true)
    expect(sameCollectionPath('/api/items#x', '/api/items')).toBe(true)
  })

  it('distinguishes different collections', () => {
    expect(sameCollectionPath('/api/items', '/api/objects')).toBe(false)
  })
})
