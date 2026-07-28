import { describe, expect, test, vi } from 'vitest'
import {
  buildItemsPathWithPopulate,
  buildStrapiUpdatePayload,
  checkDataModelImplementationInStrapi,
  fetchAllCollectionItemsFromStrapi,
  getWikidataAutosuggestFieldKeysFromSettings,
  normalizeOnlineChangedFieldsForStrapi,
  normalizeStrapiItem,
  updateViewerSettingsInStrapi,
  updateCollectionItemInStrapi,
} from './strapiApi'

describe('strapiApi helpers', () => {
  test('normalizes flattened Strapi v5 item with documentId', () => {
    const item = normalizeStrapiItem(
      {
        id: 1,
        documentId: 'doc-1',
        label: 'Card A',
        scan: 'https://example.org/a.jpg',
      },
      ['label'],
      '/api/index-cards?pagination[page]=1',
    )

    expect(item).toEqual({
      label: 'Card A',
      scan: 'https://example.org/a.jpg',
      __onlineMeta: {
        id: 'doc-1',
        idKind: 'documentId',
        idValue: 'doc-1',
        itemsPath: '/api/index-cards',
        updatedAt: undefined,
      },
    })
  })

  test('normalizes attributes shape and falls back to id', () => {
    const item = normalizeStrapiItem(
      {
        id: 17,
        attributes: {
          label: 'Card 17',
          updatedAt: '2026-07-22T00:00:00.000Z',
        },
      },
      ['label'],
      '/api/index-cards',
    )

    expect(item).toEqual({
      label: 'Card 17',
      __onlineMeta: {
        id: 17,
        idKind: 'id',
        idValue: 17,
        itemsPath: '/api/index-cards',
        updatedAt: '2026-07-22T00:00:00.000Z',
      },
    })
  })

  test('throws when no stable identifier exists', () => {
    expect(() => normalizeStrapiItem({ label: 'invalid' }, ['label'], '/api/index-cards')).toThrow(
      'stable identifier',
    )
  })

  test('builds update payload with data wrapper', () => {
    expect(buildStrapiUpdatePayload({ label: 'Changed' })).toEqual({
      data: {
        label: 'Changed',
      },
    })
  })

  test('updates collection item by resolved item path', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { id: 1 } }),
    })

    await updateCollectionItemInStrapi({
      profile: {
        baseUrl: 'https://cms.example.org/project',
      },
      itemsPath: '/api/index-cards?pagination[page]=1',
      id: 'doc-1',
      token: 'jwt-1',
      changedFields: {
        label: 'Changed',
      },
    })

    expect(globalThis.fetch).toHaveBeenCalledWith('https://cms.example.org/project/api/index-cards/doc-1', {
      method: 'PUT',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: 'Bearer jwt-1',
      },
      body: JSON.stringify({
        data: {
          label: 'Changed',
        },
      }),
    })
  })

  test('builds items path with populate[n] for complex fields', () => {
    const path = buildItemsPathWithPopulate('/api/index-cards?sort=label:asc', {
      page: 2,
      pageSize: 25,
      populateFields: ['locations', 'collectors'],
    })

    expect(path).toContain('sort=label%3Aasc')
    expect(path).toContain('pagination%5Bpage%5D=2')
    expect(path).toContain('pagination%5BpageSize%5D=25')
    expect(path).toContain('populate%5B0%5D=locations')
    expect(path).toContain('populate%5B1%5D=collectors')
  })

  test('extracts wikidata autosuggest field keys from settings', () => {
    const keys = getWikidataAutosuggestFieldKeysFromSettings({
      fields: {
        label: { type: 'normal' },
        location: { type: 'wikidata-autosuggest' },
        collector: { type: 'wikidata_autosuggest' },
      },
    })

    expect(keys).toEqual(['location', 'collector'])
  })

  test('normalizes Strapi wikidata component into viewer shape on load', () => {
    const item = normalizeStrapiItem(
      {
        documentId: 'doc-1',
        locations: [
          {
            wikidata_id: 'Q146351',
            label: 'Liberec',
            description: 'city',
            additional_data: {
              geoNames: ['3071961'],
            },
          },
        ],
      },
      {
        locations: { type: 'wikidata-autosuggest' },
      },
      '/api/index-cards',
    )

    expect(item.locations[0]).toEqual({
      id: 'Q146351',
      label: 'Liberec',
      description: 'city',
      geoNames: ['3071961'],
    })
  })

  test('normalizes viewer wikidata entities into Strapi component shape on save', () => {
    const changedFields = normalizeOnlineChangedFieldsForStrapi(
      {
        locations: [
          {
            id: 'Q146351',
            label: 'Liberec',
            description: 'city',
            geoNames: ['3071961'],
          },
        ],
      },
      {
        locations: { type: 'wikidata-autosuggest' },
      },
    )

    expect(changedFields.locations[0]).toEqual({
      wikidata_id: 'Q146351',
      label: 'Liberec',
      description: 'city',
      additional_data: {
        geoNames: ['3071961'],
      },
    })
  })

  test('updates viewer settings via configPath', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          settings: {
            version: 1,
            fields: {
              label: { type: 'normal', label: 'Label', order: 0 },
            },
          },
        },
      }),
    })

    const result = await updateViewerSettingsInStrapi({
      profile: {
        baseUrl: 'https://cms.example.org/project',
        configPath: '/api/viewer-setting',
      },
      token: 'jwt-1',
      settings: {
        version: 1,
        fields: {
          label: { type: 'normal', label: 'Label', order: 0 },
        },
      },
    })

    expect(result.settings.version).toBe(1)
    expect(globalThis.fetch).toHaveBeenCalledWith('https://cms.example.org/project/api/viewer-setting', {
      method: 'PUT',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: 'Bearer jwt-1',
      },
      body: JSON.stringify({
        data: {
          settings: {
            version: 1,
            fields: {
              label: { type: 'normal', label: 'Label', order: 0 },
            },
          },
        },
      }),
    })
  })

  test('checks data model and reports wikidata_id mismatch', async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            settings: {
              itemsPath: '/api/index-cards',
              fields: {
                label: { type: 'normal' },
                locations: { type: 'wikidata-autosuggest' },
              },
            },
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            {
              documentId: 'doc-1',
              locations: [
                {
                  wikidata_id: 'Q146351',
                  label: 'Liberec',
                },
              ],
            },
          ],
          meta: {
            pagination: {
              pageCount: 1,
            },
          },
        }),
      })

    const result = await checkDataModelImplementationInStrapi({
      profile: {
        baseUrl: 'https://cms.example.org/project',
        configPath: '/api/viewer-setting',
      },
      token: 'jwt-1',
    })

    expect(result.ok).toBe(false)
    expect(result.probePath).toContain('populate%5B0%5D=locations')
    expect(result.checks[0].message).toContain('wikidata_id')
  })

  test('checkDataModel retries when Strapi rejects populate key', async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            settings: {
              itemsPath: '/api/index-cards',
              fields: {
                location: { type: 'wikidata-autosuggest' },
              },
            },
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({
          error: {
            message: 'Invalid key location',
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            {
              documentId: 'doc-1',
              location: [],
            },
          ],
          meta: {
            pagination: {
              pageCount: 1,
            },
          },
        }),
      })

    const result = await checkDataModelImplementationInStrapi({
      profile: {
        baseUrl: 'https://cms.example.org/project',
        configPath: '/api/viewer-setting',
      },
      token: 'jwt-1',
    })

    expect(result.ok).toBe(true)
    expect(result.status).toBe('warning')
    expect(result.droppedPopulateKeys).toEqual(['location'])
    expect(result.probePath).not.toContain('populate%5B0%5D=location')
  })

  test('retries item fetch without invalid populate key', async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({
          error: {
            message: 'Invalid key location',
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [{ id: 1, documentId: 'doc-1', label: 'Card 1' }],
          meta: {
            pagination: {
              pageCount: 1,
            },
          },
        }),
      })

    const rows = await fetchAllCollectionItemsFromStrapi({
      profile: {
        baseUrl: 'https://cms.example.org/project',
      },
      itemsPath: '/api/index-cards',
      token: 'jwt-1',
      populateFields: ['location'],
    })

    expect(rows).toHaveLength(1)
    const secondCallUrl = globalThis.fetch.mock.calls[1][0]
    expect(secondCallUrl).not.toContain('populate%5B0%5D=location')
  })
})
