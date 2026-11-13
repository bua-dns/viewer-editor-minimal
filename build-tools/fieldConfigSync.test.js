import { describe, expect, test } from 'vitest'
import {
  applyFieldSync,
  checkField,
  compareSchemaAttributes,
  diffValues,
  findSchemaAttributes,
  formatReport,
  listCollections,
  listFieldChoices,
  syncBlocker,
  syncedFieldConfig,
} from './fieldConfigSync.js'

// The `collectors` configs of the xylothek viewer-setting (2026-11-13), shortened.
const sourceCollectors = {
  type: 'wikidata-autosuggest',
  fieldWidth: '100%',
  label: '',
  order: 9,
  hidden: false,
  prefillWith: 'ai_collector',
  autosuggest: {
    minChars: 2,
    limit: 50,
    prioritize: { claimPresence: { weight: 10, defs: [{ propertyId: 'P6944', propertyLabel: 'Bionomia' }] } },
    alsoGetDataFrom: [{ propertyId: 'P227', label: 'GND' }],
  },
}
const targetCollectors = {
  type: 'wikidata-autosuggest',
  fieldWidth: '100%',
  label: '',
  order: 6,
  hidden: false,
  autosuggest: { minChars: 2, limit: 50 },
}

const indexCards = {
  itemsPath: '/api/index-cards',
  fields: { label: { type: 'normal', order: 0 }, ai_collector: { type: 'normal', order: 1 }, collectors: sourceCollectors },
}
const collectionItems = {
  itemsPath: '/api/collection-items',
  fields: { label: { type: 'normal', order: 0 }, collectors: targetCollectors },
}

const reference = { type: 'component', component: 'metadata-forms.wikidata-reference', repeatable: true }
const contentTypes = {
  data: [
    { uid: 'api::index-card.index-card', schema: { pluralName: 'index-cards', attributes: { collectors: reference, label: { type: 'string' } } } },
    { uid: 'api::collection-item.collection-item', schema: { pluralName: 'collection-items', attributes: { collectors: reference } } },
  ],
}

function check(field = 'collectors', overrides = {}) {
  return checkField({
    field,
    sourceCollection: indexCards,
    targetCollection: collectionItems,
    sourceAttributes: findSchemaAttributes(contentTypes, indexCards.itemsPath),
    targetAttributes: findSchemaAttributes(contentTypes, collectionItems.itemsPath),
    ...overrides,
  })
}

describe('listCollections', () => {
  test('lists the collection attributes and leaves out v1 settings and other attributes', () => {
    const data = { settings: indexCards, index_cards: indexCards, collection_items: collectionItems, wording: {}, mappings: [] }
    expect(listCollections(data)).toEqual([
      { id: 'index_cards', itemsPath: '/api/index-cards', fieldCount: 3 },
      { id: 'collection_items', itemsPath: '/api/collection-items', fieldCount: 2 },
    ])
    expect(listCollections(null)).toEqual([])
  })
})

describe('schema', () => {
  test('finds the attributes by plural name, ignoring a query', () => {
    expect(findSchemaAttributes(contentTypes, '/api/collection-items?sort=label')).toEqual({ collectors: reference })
    expect(findSchemaAttributes(contentTypes, '/api/unknown')).toBeNull()
  })

  test('accepts the same component and names the first problem otherwise', () => {
    expect(compareSchemaAttributes(reference, { ...reference })).toMatchObject({ ok: true, problem: '' })
    expect(compareSchemaAttributes(reference, { ...reference, component: 'x.y' }).problem).toMatch(/different components/)
    expect(compareSchemaAttributes(reference, { ...reference, repeatable: false }).problem).toMatch(/repeatable/)
    expect(compareSchemaAttributes(reference, { type: 'json' }).problem).toMatch(/types differ/)
    expect(compareSchemaAttributes(reference, undefined).problem).toMatch(/target collection/)
    expect(compareSchemaAttributes(undefined, reference).problem).toMatch(/source collection/)
  })
})

describe('listFieldChoices', () => {
  test('puts components first, then fields the target configures too, then config order', () => {
    const attributes = findSchemaAttributes(contentTypes, indexCards.itemsPath)
    const source = { fields: { ai_collector: { order: 0 }, label: { order: 5 }, collectors: { order: 9 }, locations: { order: 2 } } }
    const choices = listFieldChoices(source, collectionItems, { ...attributes, locations: reference })
    expect(choices).toEqual([
      { key: 'collectors', isComponent: true, inTarget: true },
      { key: 'locations', isComponent: true, inTarget: false },
      { key: 'label', isComponent: false, inTarget: true },
      { key: 'ai_collector', isComponent: false, inTarget: false },
    ])
  })
})

describe('syncedFieldConfig', () => {
  test('keeps the target order and drops a prefillWith the target cannot use', () => {
    const { config, notes } = syncedFieldConfig(sourceCollectors, collectionItems.fields, targetCollectors)
    expect(config.order).toBe(6)
    expect(config).not.toHaveProperty('prefillWith')
    expect(config.autosuggest).toEqual(sourceCollectors.autosuggest)
    expect(notes).toEqual(['prefillWith "ai_collector" is left out: the target has no field "ai_collector".'])
  })

  test('keeps prefillWith when the target has that field, and puts a new field at the end', () => {
    const targetFields = { ai_collector: { order: 3 }, label: { order: 7 } }
    const { config, notes } = syncedFieldConfig(sourceCollectors, targetFields, undefined)
    expect(config).toMatchObject({ prefillWith: 'ai_collector', order: 8 })
    expect(notes).toEqual([])
  })
})

describe('diffValues', () => {
  test('lists differing key paths; arrays compare as a whole', () => {
    expect(diffValues({ a: 1, b: { c: [1, 2], d: 'x' } }, { a: 1, b: { c: [1], e: true } })).toEqual([
      { path: 'b.c', expected: [1, 2], actual: [1] },
      { path: 'b.d', expected: 'x', actual: undefined },
      { path: 'b.e', expected: undefined, actual: true },
    ])
  })
})

describe('checkField', () => {
  test('reports the real collectors case: same component, autosuggest differs, order ignored', () => {
    const report = check()
    expect(report.schema.ok).toBe(true)
    expect(report.configured).toEqual({ source: true, target: true })
    expect(report.differences.map((entry) => entry.path)).toEqual(['autosuggest.alsoGetDataFrom', 'autosuggest.prioritize'])
    expect(report.identical).toBe(false)
    expect(syncBlocker(report)).toBe('')
  })

  test('is identical after a sync', () => {
    const synced = applyFieldSync(collectionItems, 'collectors', sourceCollectors)
    expect(check('collectors', { targetCollection: synced }).identical).toBe(true)
    expect(synced.fields.label).toBe(collectionItems.fields.label)
  })

  test('blocks a sync on a schema mismatch or a field the source does not configure', () => {
    const mismatch = check('collectors', { targetAttributes: { collectors: { ...reference, component: 'x.y' } } })
    expect(syncBlocker(mismatch)).toMatch(/Strapi check failed: the fields use different components/)
    expect(syncBlocker(check('unknown'))).toMatch(/not configured in the source/)
  })

  test('formats the report with the differences and notes', () => {
    const lines = formatReport(check(), { from: 'index_cards', to: 'collection_items' })
    expect(lines[0]).toBe('Field "collectors": index_cards → collection_items')
    expect(lines[1]).toMatch(/Strapi:  same structure — source: component metadata-forms.wikidata-reference, repeatable/)
    expect(lines).toContain('  Config:  2 difference(s) (target vs. source):')
    expect(lines.at(-1)).toMatch(/^  Note:    prefillWith "ai_collector" is left out/)
  })
})
