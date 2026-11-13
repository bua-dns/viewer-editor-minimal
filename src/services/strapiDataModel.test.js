import { afterEach, describe, expect, test, vi } from 'vitest'
import {
  extractCollectionTypes,
  extractComponentSchemas,
  extractFieldModelFromContentTypes,
  fetchComponentSchemasFromStrapi,
  extractFieldModelFromSampleRow,
  fetchCollectionFieldModelFromStrapi,
  fetchCollectionTypesFromStrapi,
  extractRelationAttribute,
} from './strapiDataModel'

describe('extractRelationAttribute', () => {
  const payload = {
    data: [
      {
        uid: 'api::index-card.index-card',
        schema: { pluralName: 'index-cards', attributes: { label: { type: 'string' } } },
      },
      {
        uid: 'api::collection-item.collection-item',
        schema: {
          pluralName: 'collection-items',
          attributes: {
            label: { type: 'string' },
            persons: { type: 'relation', target: 'api::person.person' },
            index_cards: { type: 'relation', target: 'api::index-card.index-card' },
          },
        },
      },
    ],
  }

  test('finds the attribute pointing to the other collection', () => {
    expect(
      extractRelationAttribute(payload, { fromItemsPath: '/api/collection-items', toItemsPath: '/api/index-cards' }),
    ).toBe('index_cards')
  })

  test('returns empty when the collection has no relation to the other one', () => {
    expect(
      extractRelationAttribute(payload, { fromItemsPath: '/api/index-cards', toItemsPath: '/api/collection-items' }),
    ).toBe('')
  })
})

const profile = { baseUrl: 'https://cms.example.org/project', configPath: '/api/viewer-setting' }

const contentTypesPayload = {
  data: [
    { uid: 'api::viewer-setting.viewer-setting', schema: { pluralName: 'viewer-settings', attributes: { settings: { type: 'json' } } } },
    {
      uid: 'api::index-card.index-card',
      schema: {
        pluralName: 'index-cards',
        attributes: {
          label: { type: 'string' },
          description: { type: 'text' },
          count: { type: 'integer' },
          checked: { type: 'boolean' },
          species: { type: 'relation', relation: 'manyToOne', target: 'api::species.species' },
          createdAt: { type: 'datetime' },
          documentId: { type: 'string' },
        },
      },
    },
  ],
}

function okJson(payload) {
  return { ok: true, status: 200, json: async () => payload }
}

function forbidden() {
  return { ok: false, status: 403, json: async () => ({ error: { message: 'Forbidden' } }) }
}

const originalFetch = globalThis.fetch
afterEach(() => {
  globalThis.fetch = originalFetch
})

describe('extractFieldModelFromContentTypes', () => {
  test('takes the attributes of the content type matching the items path, without system fields', () => {
    const fields = extractFieldModelFromContentTypes(contentTypesPayload, '/api/index-cards?sort=label')

    expect(fields.map((field) => field.key)).toEqual(['label', 'description', 'count', 'checked', 'species'])
  })

  test('proposes a viewer type per Strapi type and flags structured values', () => {
    const byKey = Object.fromEntries(
      extractFieldModelFromContentTypes(contentTypesPayload, '/api/index-cards').map((field) => [field.key, field]),
    )

    expect(byKey.label).toMatchObject({ strapiType: 'string', suggestedType: 'normal', isStructured: false })
    expect(byKey.description.suggestedType).toBe('text')
    expect(byKey.count.suggestedType).toBe('integer')
    expect(byKey.checked.suggestedType).toBe('checkbox')
    expect(byKey.species).toMatchObject({ strapiType: 'relation', suggestedType: 'normal', isStructured: true })
  })

  test('keeps the component UID and repeatable of component fields', () => {
    const payload = {
      data: [
        {
          uid: 'api::index-card.index-card',
          schema: {
            pluralName: 'index-cards',
            attributes: { collectors: { type: 'component', component: 'shared.wikidata-entity', repeatable: true } },
          },
        },
      ],
    }
    expect(extractFieldModelFromContentTypes(payload, '/api/index-cards')).toEqual([
      {
        key: 'collectors',
        strapiType: 'component',
        suggestedType: 'normal',
        isStructured: true,
        component: 'shared.wikidata-entity',
        repeatable: true,
      },
    ])
  })

  test('returns null when no content type matches', () => {
    expect(extractFieldModelFromContentTypes(contentTypesPayload, '/api/unknown')).toBeNull()
    expect(extractFieldModelFromContentTypes({}, '/api/index-cards')).toBeNull()
  })
})

describe('component schemas', () => {
  const componentsPayload = {
    data: [
      { uid: 'shared.wikidata-entity', schema: { attributes: { wikidata_id: { type: 'string' } } } },
      { uid: 'broken' },
    ],
  }

  test('extractComponentSchemas maps the attributes by UID', () => {
    expect(extractComponentSchemas(componentsPayload)).toEqual({
      'shared.wikidata-entity': { wikidata_id: { type: 'string' } },
    })
    expect(extractComponentSchemas({})).toEqual({})
  })

  test('fetchComponentSchemasFromStrapi reads the components endpoint, {} when forbidden', async () => {
    globalThis.fetch = vi.fn(async () => okJson(componentsPayload))
    const schemas = await fetchComponentSchemasFromStrapi({ profile, token: 't' })
    expect(Object.keys(schemas)).toEqual(['shared.wikidata-entity'])
    expect(String(globalThis.fetch.mock.calls[0][0])).toContain('/api/content-type-builder/components')

    globalThis.fetch = vi.fn(async () => forbidden())
    expect(await fetchComponentSchemasFromStrapi({ profile, token: 't' })).toEqual({})
  })
})

describe('extractFieldModelFromSampleRow', () => {
  test('takes the keys of a v5 row and guesses types from the values', () => {
    const row = { id: 3, documentId: 'abc', label: 'x', note: null, count: 2, checked: false, tags: [{ id: 1 }] }

    const fields = extractFieldModelFromSampleRow(row)

    expect(fields.map((field) => [field.key, field.strapiType, field.suggestedType])).toEqual([
      ['label', '', 'normal'],
      ['note', '', 'normal'],
      ['count', 'integer', 'integer'],
      ['checked', 'boolean', 'checkbox'],
      ['tags', 'json', 'normal'],
    ])
  })

  test('reads v4 rows from attributes and handles a missing row', () => {
    expect(extractFieldModelFromSampleRow({ id: 1, attributes: { label: 'x' } }).map((field) => field.key)).toEqual(['label'])
    expect(extractFieldModelFromSampleRow(null)).toEqual([])
  })
})

describe('fetchCollectionFieldModelFromStrapi', () => {
  test('uses the content-type schema when it is readable', async () => {
    globalThis.fetch = vi.fn(async () => okJson(contentTypesPayload))

    const result = await fetchCollectionFieldModelFromStrapi({ profile, token: 't', itemsPath: '/api/index-cards' })

    expect(result.source).toBe('schema')
    expect(result.fields).toHaveLength(5)
    expect(globalThis.fetch).toHaveBeenCalledTimes(1)
    expect(globalThis.fetch.mock.calls[0][0]).toContain('/api/content-type-builder/content-types')
  })

  test('falls back to a sample item with populate=* when the schema is forbidden', async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce(forbidden())
      .mockResolvedValueOnce(okJson({ data: [{ id: 1, documentId: 'a', label: 'x', species: { id: 2 } }] }))

    const result = await fetchCollectionFieldModelFromStrapi({ profile, token: 't', itemsPath: '/api/index-cards' })

    expect(result).toMatchObject({ source: 'sample' })
    expect(result.fields.map((field) => field.key)).toEqual(['label', 'species'])
    const sampleUrl = new URL(globalThis.fetch.mock.calls[1][0])
    expect(sampleUrl.pathname).toBe('/project/api/index-cards')
    expect(sampleUrl.searchParams.get('pagination[pageSize]')).toBe('1')
    expect(sampleUrl.searchParams.get('populate')).toBe('*')
  })

  test('retries the sample without populate when populate=* is rejected', async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce(forbidden())
      .mockResolvedValueOnce(forbidden())
      .mockResolvedValueOnce(okJson({ data: [{ id: 1, label: 'x' }] }))

    const result = await fetchCollectionFieldModelFromStrapi({ profile, token: 't', itemsPath: '/api/index-cards' })

    expect(result.fields.map((field) => field.key)).toEqual(['label'])
    expect(new URL(globalThis.fetch.mock.calls[2][0]).searchParams.has('populate')).toBe(false)
  })

  test('fails when neither the schema nor the items are readable', async () => {
    globalThis.fetch = vi.fn(async () => forbidden())

    await expect(
      fetchCollectionFieldModelFromStrapi({ profile, token: 't', itemsPath: '/api/index-cards' }),
    ).rejects.toThrow('Forbidden')
  })
})

describe('collection types (targets of derivation rules)', () => {
  test('lists the project collection types by display name, not single types or plugins', () => {
    const payload = {
      data: [
        { uid: 'api::viewer-setting.viewer-setting', schema: { kind: 'singleType', pluralName: 'viewer-settings' } },
        { uid: 'api::index-card.index-card', schema: { kind: 'collectionType', pluralName: 'index-cards', displayName: 'Index card' } },
        { uid: 'api::collection-item.collection-item', schema: { kind: 'collectionType', pluralName: 'collection-items', displayName: 'Collection item' } },
        { uid: 'plugin::users-permissions.user', schema: { kind: 'collectionType', pluralName: 'users' } },
      ],
    }
    expect(extractCollectionTypes(payload)).toEqual([
      { path: '/api/collection-items', name: 'Collection item' },
      { path: '/api/index-cards', name: 'Index card' },
    ])
  })

  test('gives an empty list when the schema is not readable', async () => {
    globalThis.fetch = vi.fn(async () => forbidden())
    await expect(fetchCollectionTypesFromStrapi({ profile, token: 't' })).resolves.toEqual([])
  })
})
