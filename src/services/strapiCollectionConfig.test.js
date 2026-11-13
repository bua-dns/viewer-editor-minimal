import { afterEach, describe, expect, test, vi } from 'vitest'
import { buildLinkedItemsPath, updateCollectionConfigInStrapi } from './strapiCollectionConfig'

const profile = { version: 1, baseUrl: 'https://cms.example.org', configPath: '/api/viewer-setting' }

function jsonResponse(body) {
  return { ok: true, status: 200, json: async () => body }
}

describe('buildLinkedItemsPath', () => {
  test('filters by the relation to the primary item (documentId)', () => {
    const path = decodeURIComponent(
      buildLinkedItemsPath({
        itemsPath: '/api/collection-items',
        relationAttribute: 'index_cards',
        linkedTo: { id: 'abc', idKind: 'documentId' },
        populateFields: ['taxon', 'taxon'],
      }),
    )
    expect(path).toContain('/api/collection-items?')
    expect(path).toContain('filters[index_cards][documentId][$eq]=abc')
    expect(path).toContain('pagination[pageSize]=100')
    expect(path).toContain('populate[0]=taxon')
    expect(path).not.toContain('populate[1]')
  })

  test('uses the numeric id for Strapi 4 items', () => {
    const path = decodeURIComponent(
      buildLinkedItemsPath({ itemsPath: '/api/x', relationAttribute: 'y', linkedTo: { id: 7, idKind: 'id' } }),
    )
    expect(path).toContain('filters[y][id][$eq]=7')
  })
})

describe('updateCollectionConfigInStrapi', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('reads the attribute fresh, sends only that attribute and returns the answer', async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ data: { index_cards: { fields: {}, replacements: { a: {} } } } }))
      .mockResolvedValueOnce(jsonResponse({ data: { index_cards: { fields: { x: {} }, replacements: { a: {} } } } }))

    const result = await updateCollectionConfigInStrapi({
      profile,
      token: 't',
      collectionId: 'index_cards',
      update: (current) => ({ ...current, fields: { x: {} } }),
    })

    const [, putInit] = globalThis.fetch.mock.calls[1]
    expect(putInit.method).toBe('PUT')
    expect(JSON.parse(putInit.body)).toEqual({
      data: { index_cards: { fields: { x: {} }, replacements: { a: {} } } },
    })
    expect(result.config.fields).toEqual({ x: {} })
  })

  test('fails without the attribute and does not write', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce(jsonResponse({ data: { settings: {} } }))
    await expect(
      updateCollectionConfigInStrapi({ profile, collectionId: 'index_cards', update: (current) => current }),
    ).rejects.toThrow('"index_cards"')
    expect(globalThis.fetch).toHaveBeenCalledTimes(1)
  })
})
