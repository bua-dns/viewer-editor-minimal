// Pure hierarchy helpers shared by the online and the offline hierarchy view.
// No Vue, no stores: every input is passed in.

import { isPlainObject } from './objects'

export function normalizeHierarchyValue(value) {
  if (value == null) return ''
  return String(value).trim()
}

export function normalizeHierarchyFieldList(rawFields) {
  if (Array.isArray(rawFields)) {
    return Array.from(new Set(rawFields.map((entry) => String(entry || '').trim()).filter(Boolean)))
  }

  if (typeof rawFields === 'string' && rawFields.trim()) {
    return Array.from(
      new Set(
        rawFields
          .split(',')
          .map((entry) => String(entry || '').trim())
          .filter(Boolean),
      ),
    )
  }

  return []
}

// Where a settings record or a config file may name its hierarchy fields, in order of precedence.
// Canonical is `hierarchyFields`; the others are legacy shapes still found in exported files.
const HIERARCHY_FIELD_LIST_KEYS = [
  (source) => source.hierarchyFields,
  (source) => source.hierarchy_fields,
  (source) => source.hierarchicalFields,
  (source) => source.hierarchy?.fields,
  (source) => source.config?.hierarchyFields,
  (source) => source.config?.hierarchy_fields,
]

const FIRST_LEVEL_STATIC_LIST_KEYS = [
  (source) => source.firstLevelStaticList,
  (source) => source.first_level_static_list,
  (source) => source.hierarchy?.firstLevelStaticList,
  (source) => source.config?.firstLevelStaticList,
]

// Field keys that name the two levels by themselves when no list is configured.
const AUTO_DETECTED_LEVEL_FIELDS = [
  ['level_1', 'level_2'],
  ['level1', 'level2'],
]

function levelsFromHierarchyObject(hierarchy) {
  if (!isPlainObject(hierarchy)) return null
  const level1 = normalizeHierarchyValue(hierarchy.level1 || hierarchy.level_1)
  const level2 = normalizeHierarchyValue(hierarchy.level2 || hierarchy.level_2)
  return level1 && level2 ? [level1, level2] : null
}

function autoDetectedLevelFields(fields) {
  if (!isPlainObject(fields)) return null
  const pair = AUTO_DETECTED_LEVEL_FIELDS.find(([level1, level2]) =>
    Object.prototype.hasOwnProperty.call(fields, level1) && Object.prototype.hasOwnProperty.call(fields, level2),
  )
  return pair ? [...pair] : null
}

/**
 * Hierarchy fields of a Strapi settings record (online) or of a config payload (file, offline):
 * one resolver for both, so the same shape gives the same hierarchy in both modes.
 *
 * 1. the first list candidate (see HIERARCHY_FIELD_LIST_KEYS) with at least two entries;
 * 2. `hierarchy: { level1, level2 }` (also `level_1` / `level_2`);
 * 3. fields named `level_1` + `level_2` or `level1` + `level2`;
 * 4. otherwise the first non-empty list, even with one entry: an unfinished hierarchy from the
 *    Konfiguration tab survives export and import. Consumers enable the hierarchy only with two.
 */
export function resolveHierarchyFieldsFromSettings(settings) {
  if (!isPlainObject(settings)) return []
  const lists = HIERARCHY_FIELD_LIST_KEYS.map((read) => normalizeHierarchyFieldList(read(settings)))
  const complete = lists.find((list) => list.length >= 2)
  if (complete) return complete

  return (
    levelsFromHierarchyObject(settings.hierarchy) ||
    autoDetectedLevelFields(settings.fields) ||
    lists.find((list) => list.length > 0) ||
    []
  )
}

/** Fixed level-1 values (order of the boxes): the first array among FIRST_LEVEL_STATIC_LIST_KEYS. */
export function resolveFirstLevelStaticList(settings) {
  if (!isPlainObject(settings)) return []
  const list = FIRST_LEVEL_STATIC_LIST_KEYS.map((read) => read(settings)).find(Array.isArray) || []
  return Array.from(new Set(list.map(normalizeHierarchyValue).filter(Boolean)))
}

function countValues(items, groupFieldKey, includeItem) {
  const countsByValue = new Map()
  ;(Array.isArray(items) ? items : []).forEach((item) => {
    if (!includeItem(item)) return
    const normalized = normalizeHierarchyValue(item?.[groupFieldKey])
    countsByValue.set(normalized, (countsByValue.get(normalized) || 0) + 1)
  })
  return countsByValue
}

function toSortedOptions(countsByValue) {
  const assigned = []
  let unassignedCount = 0
  countsByValue.forEach((count, value) => {
    if (!value) {
      unassignedCount += count
      return
    }
    assigned.push({ value, count, isUnassigned: false })
  })

  assigned.sort((left, right) => left.value.localeCompare(right.value))
  if (unassignedCount > 0) {
    assigned.push({ value: '', count: unassignedCount, isUnassigned: true })
  }

  return assigned
}

/**
 * Level-1 boxes from the level-1 values alone, one per item (online: fetched without the items).
 * Alphabetically, the unassigned bucket last.
 */
export function buildHierarchyLevel1OptionsFromValues(values) {
  const valueItems = (Array.isArray(values) ? values : []).map((value) => ({ value }))
  return toSortedOptions(countValues(valueItems, 'value', () => true))
}

/**
 * Level-1 boxes built from loaded items (offline mode).
 *
 * Without a static list: every value found, alphabetically, the unassigned bucket last.
 * With a static list: its entries first, in list order and with their counts (0 when no item
 * carries the value); values found in the data but missing from the list follow alphabetically,
 * so no item becomes unreachable; the unassigned bucket stays last.
 */
export function buildHierarchyLevel1Options(items, level1FieldKey, staticList = []) {
  const countsByValue = countValues(items, level1FieldKey, () => true)
  const presetValues = normalizeHierarchyFieldList(staticList)
  if (!presetValues.length) return toSortedOptions(countsByValue)

  const presetOptions = presetValues.map((value) => ({
    value,
    count: countsByValue.get(value) || 0,
    isUnassigned: false,
  }))
  const remainingCounts = new Map(countsByValue)
  presetValues.forEach((value) => remainingCounts.delete(value))

  return [...presetOptions, ...toSortedOptions(remainingCounts)]
}

export function buildHierarchyLevel2Options(items, level1FieldKey, level2FieldKey, selectedLevel1Value) {
  const normalizedSelectedLevel1 = normalizeHierarchyValue(selectedLevel1Value)
  const countsByValue = countValues(
    items,
    level2FieldKey,
    (item) => normalizeHierarchyValue(item?.[level1FieldKey]) === normalizedSelectedLevel1,
  )
  return toSortedOptions(countsByValue)
}

export function isItemInHierarchyLevel1(item, level1FieldKey, selectedLevel1Value) {
  return normalizeHierarchyValue(item?.[level1FieldKey]) === normalizeHierarchyValue(selectedLevel1Value)
}
