import { describe, expect, test, vi } from 'vitest'
import {
  buildItemsPathWithPopulate,
  buildStrapiUpdatePayload,
  checkDataModelImplementationInStrapi,
  fetchViewerSettingsFromStrapi,
  fetchAllCollectionItemsFromStrapi,
  getWikidataAutosuggestFieldKeysFromSettings,
  normalizeOnlineChangedFieldsForStrapi,
  normalizeStrapiItem,
  resolveScanFieldFromSettings,
  updateViewerReplacementsInStrapi,
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

  test('resolves the scan source field from settings with legacy and default fallback', () => {
    expect(resolveScanFieldFromSettings({ scanField: ' scan_url ' })).toBe('scan_url')
    expect(resolveScanFieldFromSettings({ scan_field: 'scan_url' })).toBe('scan_url')
    expect(resolveScanFieldFromSettings({})).toBe('scan')
    expect(resolveScanFieldFromSettings(null)).toBe('scan')
  })

  test('maps a configured scan source field onto scan', () => {
    const item = normalizeStrapiItem(
      {
        id: 8,
        documentId: 'doc-8',
        file: '00003.jpg',
        scan: '3',
        scan_url: 'https://example.org/00003.jpg',
      },
      ['file'],
      '/api/index-cards',
      'scan_url',
    )

    expect(item.scan).toBe('https://example.org/00003.jpg')
    expect(item.file).toBe('00003.jpg')
  })

  test('omits scan when the configured scan source field is missing', () => {
    const item = normalizeStrapiItem(
      { id: 9, documentId: 'doc-9', label: 'Card B', scan: '9' },
      ['label'],
      '/api/index-cards',
      'scan_url',
    )

    expect(Object.prototype.hasOwnProperty.call(item, 'scan')).toBe(false)
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
      fieldKeys: ['level_1'],
      filtersEq: { level_1: 'A' },
    })

    expect(path).toContain('sort=label%3Aasc')
    expect(path).toContain('pagination%5Bpage%5D=2')
    expect(path).toContain('pagination%5BpageSize%5D=25')
    expect(path).toContain('populate%5B0%5D=locations')
    expect(path).toContain('populate%5B1%5D=collectors')
    expect(path).toContain('fields%5B0%5D=level_1')
    expect(path).toContain('filters%5Blevel_1%5D%5B%24eq%5D=A')
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

  test('loads viewer settings and optional wording from singleton endpoint', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          settings: {
            version: 1,
            fields: {},
          },
          wording: {
            appTitle: {
              de: 'Online Titel',
            },
          },
        },
      }),
    })

    const result = await fetchViewerSettingsFromStrapi({
      profile: {
        baseUrl: 'https://cms.example.org/project',
        configPath: '/api/viewer-setting',
      },
      token: 'jwt-1',
    })

    expect(result.settings.version).toBe(1)
    expect(result.wording.appTitle.de).toBe('Online Titel')
  })

  test('loads replacements from the dedicated prop and falls back to the settings object', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          settings: { version: 1, fields: {}, replacements: { allFields: { legacy: 'legacy' } } },
          replacements: { allFields: { 'i. Schl.': 'in Schlesien' } },
        },
      }),
    })

    const profile = { baseUrl: 'https://cms.example.org', configPath: '/api/viewer-setting' }
    const result = await fetchViewerSettingsFromStrapi({ profile, token: 'jwt-1' })
    expect(result.replacements).toEqual({ allFields: { 'i. Schl.': 'in Schlesien' } })

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: { settings: { version: 1, fields: {}, replacements: { allFields: { legacy: 'kept' } } } },
      }),
    })

    const legacyResult = await fetchViewerSettingsFromStrapi({ profile, token: 'jwt-1' })
    expect(legacyResult.replacements).toEqual({ allFields: { legacy: 'kept' } })
  })

  test('writes replacements to the config singleton', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { replacements: { allFields: { a: 'b' } } } }),
    })

    const result = await updateViewerReplacementsInStrapi({
      profile: { baseUrl: 'https://cms.example.org/project', configPath: '/api/viewer-setting' },
      token: 'jwt-1',
      replacements: { allFields: { a: 'b' } },
    })

    expect(result.replacements).toEqual({ allFields: { a: 'b' } })
    const [url, init] = globalThis.fetch.mock.calls[0]
    expect(url).toBe('https://cms.example.org/project/api/viewer-setting')
    expect(init.method).toBe('PUT')
    expect(JSON.parse(init.body)).toEqual({ data: { replacements: { allFields: { a: 'b' } } } })
  })

  test('fails when the config singleton has no replacements prop', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { settings: { version: 1 } } }),
    })

    await expect(
      updateViewerReplacementsInStrapi({
        profile: { baseUrl: 'https://cms.example.org', configPath: '/api/viewer-setting' },
        replacements: {},
      }),
    ).rejects.toThrow(/data\.replacements/)
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
