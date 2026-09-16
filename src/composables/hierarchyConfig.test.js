import { describe, expect, test } from 'vitest'
import {
  buildHierarchyLevel1Options,
  buildHierarchyLevel2Options,
  isItemInHierarchyLevel1,
  normalizeHierarchyFieldList,
  resolveHierarchyFieldsFromSettings,
} from './hierarchyConfig'

const items = [
  { region: 'Brandenburg', site: 'Lebus' },
  { region: 'Sachsen', site: 'Dresden' },
  { region: ' Brandenburg ', site: 'Lebus' },
  { region: 'Brandenburg', site: '' },
  { region: '', site: 'Unbekannt' },
  { site: 'Ohne Region' },
]

describe('normalizeHierarchyFieldList', () => {
  test('trims, drops empty entries and deduplicates arrays and comma strings', () => {
    expect(normalizeHierarchyFieldList([' level_1 ', '', 'level_2', 'level_1'])).toEqual(['level_1', 'level_2'])
    expect(normalizeHierarchyFieldList('level_1, level_2,,')).toEqual(['level_1', 'level_2'])
    expect(normalizeHierarchyFieldList(null)).toEqual([])
  })
})

describe('resolveHierarchyFieldsFromSettings', () => {
  test('reads top-level, nested and object shapes', () => {
    expect(resolveHierarchyFieldsFromSettings({ hierarchyFields: ['a', 'b'] })).toEqual(['a', 'b'])
    expect(resolveHierarchyFieldsFromSettings({ hierarchy: { fields: ['a', 'b'] } })).toEqual(['a', 'b'])
    expect(resolveHierarchyFieldsFromSettings({ hierarchy: { level1: 'a', level2: 'b' } })).toEqual(['a', 'b'])
  })

  test('falls through a candidate with fewer than two entries', () => {
    expect(
      resolveHierarchyFieldsFromSettings({ hierarchyFields: ['a'], hierarchy: { fields: ['a', 'b'] } }),
    ).toEqual(['a', 'b'])
  })

  test('auto-detects level fields and returns nothing without settings', () => {
    expect(resolveHierarchyFieldsFromSettings({ fields: { level_1: {}, level_2: {} } })).toEqual([
      'level_1',
      'level_2',
    ])
    expect(resolveHierarchyFieldsFromSettings(null)).toEqual([])
  })
})

describe('buildHierarchyLevel1Options', () => {
  test('counts trimmed values alphabetically and puts the unassigned bucket last', () => {
    expect(buildHierarchyLevel1Options(items, 'region')).toEqual([
      { value: 'Brandenburg', count: 3, isUnassigned: false },
      { value: 'Sachsen', count: 1, isUnassigned: false },
      { value: '', count: 2, isUnassigned: true },
    ])
  })

  test('a static list fixes order and keeps values missing from the list reachable', () => {
    expect(buildHierarchyLevel1Options(items, 'region', ['Sachsen', 'Thueringen'])).toEqual([
      { value: 'Sachsen', count: 1, isUnassigned: false },
      { value: 'Thueringen', count: 0, isUnassigned: false },
      { value: 'Brandenburg', count: 3, isUnassigned: false },
      { value: '', count: 2, isUnassigned: true },
    ])
  })
})

describe('buildHierarchyLevel2Options', () => {
  test('groups only the items of the selected level-1 value', () => {
    expect(buildHierarchyLevel2Options(items, 'region', 'site', 'Brandenburg')).toEqual([
      { value: 'Lebus', count: 2, isUnassigned: false },
      { value: '', count: 1, isUnassigned: true },
    ])
  })

  test('the empty level-1 value selects items without a level-1 value', () => {
    expect(buildHierarchyLevel2Options(items, 'region', 'site', '')).toEqual([
      { value: 'Ohne Region', count: 1, isUnassigned: false },
      { value: 'Unbekannt', count: 1, isUnassigned: false },
    ])
  })
})

describe('isItemInHierarchyLevel1', () => {
  test('compares trimmed values and treats a missing value as unassigned', () => {
    expect(isItemInHierarchyLevel1({ region: ' Sachsen ' }, 'region', 'Sachsen')).toBe(true)
    expect(isItemInHierarchyLevel1({}, 'region', '')).toBe(true)
    expect(isItemInHierarchyLevel1({ region: 'Sachsen' }, 'region', '')).toBe(false)
  })
})
