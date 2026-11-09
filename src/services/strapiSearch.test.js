import { afterEach, describe, expect, test, vi } from 'vitest'
import { buildContainsFilterEntries, resolveSearchableFieldKeys, searchCollectionItemsInStrapi } from './strapiSearch'

const profile = { baseUrl: 'https://cms.example.org/project', configPath: '/api/viewer-setting' }

function okPage(rows) {
  return { ok: true, json: async () => ({ data: rows, meta: { pagination: { pageCount: 1 } } }) }
}

function invalidKey(name) {
  return { ok: false, status: 400, json: async () => ({ error: { message: `Invalid key ${name}` } }) }
}

function requestedQuery(callIndex) {
  const url = new URL(globalThis.fetch.mock.calls[callIndex][0])
  return url.searchParams
}

const originalFetch = globalThis.fetch
afterEach(() => {
  globalThis.fetch = originalFetch
})

describe('resolveSearchableFieldKeys', () => {
  test('takes text fields and the hierarchy fields, skips other types', () => {
    const settings = {
      fields: {
        title: { type: 'normal' },
        description: { type: 'text' },
        guess: { type: 'candidate' },
        untyped: {},
        done: { type: 'checkbox' },
        year: { type: 'integer' },
        place: { type: 'wikidata-autosuggest' },
      },
    }
    expect(resolveSearchableFieldKeys(settings, ['box', 'drawer', 'title'])).toEqual([
      'title',
      'description',
      'guess',
      'untyped',
      'box',
      'drawer',
    ])
  })

  test('works without fields in the settings', () => {
    expect(resolveSearchableFieldKeys({}, ['box', 'drawer'])).toEqual(['box', 'drawer'])
    expect(resolveSearchableFieldKeys(null)).toEqual([])
  })
})

describe('buildContainsFilterEntries', () => {
  test('ANDs the tokens and ORs the fields per token', () => {
    expect(buildContainsFilterEntries(['oak', 'berlin'], ['title', 'description'])).toEqual([
      ['filters[$and][0][$or][0][title][$containsi]', 'oak'],
      ['filters[$and][0][$or][1][description][$containsi]', 'oak'],
      ['filters[$and][1][$or][0][title][$containsi]', 'berlin'],
      ['filters[$and][1][$or][1][description][$containsi]', 'berlin'],
    ])
  })
})

describe('searchCollectionItemsInStrapi', () => {
  test('sends the contains filters with the item request', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(okPage([{ documentId: 'a', title: 'Oak' }]))

    const result = await searchCollectionItemsInStrapi({
      profile,
      itemsPath: '/api/items',
      tokens: ['oak'],
      fieldKeys: ['title', 'box'],
    })

    expect(result.rows).toHaveLength(1)
    expect(result.droppedFieldKeys).toEqual([])
    const query = requestedQuery(0)
    expect(query.get('filters[$and][0][$or][0][title][$containsi]')).toBe('oak')
    expect(query.get('filters[$and][0][$or][1][box][$containsi]')).toBe('oak')
  })

  test('drops a field Strapi refuses to filter and searches again', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce(invalidKey('box')).mockResolvedValueOnce(okPage([]))

    const result = await searchCollectionItemsInStrapi({
      profile,
      itemsPath: '/api/items',
      tokens: ['oak'],
      fieldKeys: ['title', 'box'],
    })

    expect(result.searchedFieldKeys).toEqual(['title'])
    expect(result.droppedFieldKeys).toEqual(['box'])
    expect(globalThis.fetch).toHaveBeenCalledTimes(2)
    expect(requestedQuery(1).has('filters[$and][0][$or][1][box][$containsi]')).toBe(false)
  })

  test('fails when no field is left to search', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce(invalidKey('title'))

    await expect(
      searchCollectionItemsInStrapi({ profile, itemsPath: '/api/items', tokens: ['oak'], fieldKeys: ['title'] }),
    ).rejects.toThrow('None of the configured fields')
  })

  test('refuses more hits than the limit after the first page, naming their number (review F3)', async () => {
    const rows = [{ documentId: 'a' }, { documentId: 'b' }]
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: rows, meta: { pagination: { pageCount: 40, total: 4000 } } }),
    })

    await expect(
      searchCollectionItemsInStrapi({ profile, itemsPath: '/api/items', tokens: ['der'], fieldKeys: ['title'], maxHits: 500 }),
    ).rejects.toMatchObject({ code: 'TOO_MANY_ITEMS', message: expect.stringContaining('4000 hits') })
    expect(globalThis.fetch).toHaveBeenCalledTimes(1)
  })

  test('without a total, stops as soon as the collected hits exceed the limit', async () => {
    const page = (ids) => ({ ok: true, json: async () => ({ data: ids.map((documentId) => ({ documentId })), meta: { pagination: { pageCount: 9 } } }) })
    globalThis.fetch = vi.fn().mockResolvedValueOnce(page(['a', 'b'])).mockResolvedValueOnce(page(['c', 'd']))

    await expect(
      searchCollectionItemsInStrapi({ profile, itemsPath: '/api/items', tokens: ['der'], fieldKeys: ['title'], maxHits: 3 }),
    ).rejects.toThrow('More than 3 hits')
    expect(globalThis.fetch).toHaveBeenCalledTimes(2)
  })

  test('loads all pages while the hits stay within the limit', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ documentId: 'a' }], meta: { pagination: { pageCount: 1, total: 1 } } }),
    })

    const result = await searchCollectionItemsInStrapi({ profile, itemsPath: '/api/items', tokens: ['oak'], fieldKeys: ['title'] })

    expect(result.rows).toHaveLength(1)
  })

  test('passes other errors through', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ error: { message: 'Server down' } }),
    })

    await expect(
      searchCollectionItemsInStrapi({ profile, itemsPath: '/api/items', tokens: ['oak'], fieldKeys: ['title'] }),
    ).rejects.toThrow('Server down')
  })
})
