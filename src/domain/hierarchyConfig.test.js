import { readFileSync } from 'node:fs'
import { describe, expect, test } from 'vitest'
import {
  buildHierarchyLevel1Options,
  buildHierarchyLevel1OptionsFromValues,
  buildHierarchyLevel2Options,
  isItemInHierarchyLevel1,
  normalizeHierarchyFieldList,
  resolveFirstLevelStaticList,
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

  // Shape matrix (review F6 / plan step 3.1): every shape any of the three former resolvers
  // accepted. Online settings and offline config files go through this one function now.
  const liveSample = JSON.parse(
    readFileSync(new URL('./fixtures/viewer-setting.sample.json', import.meta.url), 'utf8'),
  )
  const shapeMatrix = [
    ['canonical array', { hierarchyFields: ['a', 'b'] }, ['a', 'b']],
    ['comma string', { hierarchyFields: 'a, b' }, ['a', 'b']],
    ['snake_case key', { hierarchy_fields: ['a', 'b'] }, ['a', 'b']],
    ['hierarchicalFields key', { hierarchicalFields: ['a', 'b'] }, ['a', 'b']],
    ['hierarchy.fields', { hierarchy: { fields: ['a', 'b'] } }, ['a', 'b']],
    ['config.hierarchyFields', { config: { hierarchyFields: ['a', 'b'] } }, ['a', 'b']],
    ['config.hierarchy_fields', { config: { hierarchy_fields: ['a', 'b'] } }, ['a', 'b']],
    ['hierarchy object, camelCase', { hierarchy: { level1: 'a', level2: 'b' } }, ['a', 'b']],
    ['hierarchy object, snake_case', { hierarchy: { level_1: 'a', level_2: 'b' } }, ['a', 'b']],
    ['auto-detected level_1/level_2', { fields: { level_1: {}, level_2: {} } }, ['level_1', 'level_2']],
    ['auto-detected level1/level2', { fields: { level1: {}, level2: {} } }, ['level1', 'level2']],
    ['empty canonical list does not hide a legacy key', { hierarchyFields: [], hierarchy_fields: ['a', 'b'] }, ['a', 'b']],
    ['conflict: first candidate with two entries wins', { hierarchyFields: ['x'], hierarchy: { fields: ['a', 'b'] } }, ['a', 'b']],
    ['one entry only: kept, the hierarchy stays off', { hierarchyFields: ['a'] }, ['a']],
    ['complete list beats auto-detection', { hierarchyFields: ['a', 'b'], fields: { level_1: {}, level_2: {} } }, ['a', 'b']],
    ['nothing configured', { fields: { title: {} } }, []],
    ['live settings sample (hierarchyFields: [])', liveSample.data.settings, []],
  ]

  test.each(shapeMatrix)('%s', (_label, settings, expected) => {
    expect(resolveHierarchyFieldsFromSettings(settings)).toEqual(expected)
  })
})

describe('resolveFirstLevelStaticList', () => {
  test.each([
    ['canonical', { firstLevelStaticList: [' 001 ', '002', '001', ''] }, ['001', '002']],
    ['snake_case', { first_level_static_list: ['a'] }, ['a']],
    ['hierarchy object', { hierarchy: { firstLevelStaticList: ['a'] } }, ['a']],
    ['config object', { config: { firstLevelStaticList: ['a'] } }, ['a']],
    ['first array wins', { firstLevelStaticList: ['a'], first_level_static_list: ['b'] }, ['a']],
    ['a comma string is not a list', { firstLevelStaticList: 'a, b' }, []],
    ['nothing', null, []],
  ])('%s', (_label, settings, expected) => {
    expect(resolveFirstLevelStaticList(settings)).toEqual(expected)
  })
})

describe('buildHierarchyLevel1OptionsFromValues', () => {
  test('counts trimmed values alphabetically and puts the unassigned bucket last', () => {
    expect(buildHierarchyLevel1OptionsFromValues(['B', ' A ', 'B', '', null, 'A'])).toEqual([
      { value: 'A', count: 2, isUnassigned: false },
      { value: 'B', count: 2, isUnassigned: false },
      { value: '', count: 2, isUnassigned: true },
    ])
    expect(buildHierarchyLevel1OptionsFromValues(undefined)).toEqual([])
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
