import { describe, expect, test } from 'vitest'
import {
  LAYOUT_V1,
  LAYOUT_V2,
  mergeOnlineSettings,
  mergeReplacementsIntoCollectionConfig,
  mergeSettingsIntoCollectionConfig,
  readViewerSettingsLayout,
} from './viewerSettingsLayout'

const indexCards = {
  itemsPath: '/api/index-cards',
  fields: { label: { type: 'normal' } },
  language: 'en',
  replacements: { label: { a: 'b' } },
  relations: { collection_items: 'collection_items' },
}
const collectionItems = { itemsPath: '/api/collection-items', fields: { name: { type: 'normal' } } }

describe('readViewerSettingsLayout', () => {
  test('without a primary collection the record is read as v1', () => {
    const result = readViewerSettingsLayout({ settings: { itemsPath: '/api/items' }, replacements: { x: { a: 'b' } } })
    expect(result.layout).toBe(LAYOUT_V1)
    expect(result.settings).toEqual({ itemsPath: '/api/items' })
    expect(result.replacements).toEqual({ x: { a: 'b' } })
    expect(result.secondaries).toEqual([])
  })

  test('v1 still reads replacements kept inside the settings', () => {
    const result = readViewerSettingsLayout({ settings: { replacements: { x: {} } } })
    expect(result.replacements).toEqual({ x: {} })
  })

  test('v1 without settings fails', () => {
    expect(() => readViewerSettingsLayout({})).toThrow('data.settings')
  })

  test('v2 hands on the primary attribute as settings, without replacements and omitted keys', () => {
    const result = readViewerSettingsLayout(
      { settings: { itemsPath: '/api/old' }, index_cards: indexCards, collection_items: collectionItems },
      { primaryCollection: 'index_cards', secondaryCollections: ['collection_items'], omitKeys: ['language'] },
    )
    expect(result.layout).toBe(LAYOUT_V2)
    expect(result.primaryId).toBe('index_cards')
    expect(result.settings).toEqual({
      itemsPath: '/api/index-cards',
      fields: { label: { type: 'normal' } },
      relations: { collection_items: 'collection_items' },
    })
    expect(result.replacements).toEqual({ label: { a: 'b' } })
    expect(result.secondaries).toEqual([{ id: 'collection_items', config: collectionItems, error: '' }])
  })

  test('v2 names a missing primary attribute', () => {
    expect(() => readViewerSettingsLayout({ settings: {} }, { primaryCollection: 'index_cards' })).toThrow(
      '"index_cards"',
    )
  })

  test('v2 marks a missing secondary attribute instead of failing', () => {
    const result = readViewerSettingsLayout(
      { index_cards: indexCards },
      { primaryCollection: 'index_cards', secondaryCollections: ['persons'] },
    )
    expect(result.secondaries[0]).toMatchObject({ id: 'persons', config: null })
    expect(result.secondaries[0].error).toContain('"persons"')
  })
})

describe('merging into a collection attribute', () => {
  test('new settings keep the stored replacements and drop omitted keys', () => {
    const next = mergeSettingsIntoCollectionConfig(
      indexCards,
      { itemsPath: '/api/index-cards', fields: {}, language: 'de', replacements: { stale: {} } },
      ['language'],
    )
    expect(next).toEqual({
      itemsPath: '/api/index-cards',
      fields: {},
      replacements: { label: { a: 'b' } },
      relations: { collection_items: 'collection_items' },
    })
  })

  test('new replacements keep everything else', () => {
    const next = mergeReplacementsIntoCollectionConfig(collectionItems, { name: { x: 'y' } })
    expect(next).toEqual({ ...collectionItems, replacements: { name: { x: 'y' } } })
  })
})

describe('mergeOnlineSettings', () => {
  test('keeps unedited keys, replaces field config and viewer settings', () => {
    const merged = mergeOnlineSettings(
      { itemsPath: '/api/x', fields: { old: {} }, language: 'en', primaryColor: '#000' },
      { version: 1, fields: { new: {} } },
      { viewerSettingKeys: ['language', 'primaryColor'], viewerOverrides: { primaryColor: '#fff' } },
    )
    expect(merged).toEqual({ itemsPath: '/api/x', version: 1, fields: { new: {} }, primaryColor: '#fff' })
  })
})
