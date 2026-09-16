//src\composables\hierarchyConfig.js
// Pure hierarchy helpers shared by the online and the offline hierarchy view.
// No Vue, no stores: every input is passed in.

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

/**
 * Hierarchy fields as read from the Strapi settings singleton (online mode).
 * Takes the first candidate with at least two entries.
 */
export function resolveHierarchyFieldsFromSettings(settings) {
  const direct = normalizeHierarchyFieldList(
    settings?.hierarchyFields || settings?.hierarchy_fields || settings?.hierarchicalFields,
  )
  if (direct.length >= 2) return direct

  const nested = normalizeHierarchyFieldList(settings?.hierarchy?.fields || settings?.config?.hierarchyFields)
  if (nested.length >= 2) return nested

  const hierarchyObject = settings?.hierarchy
  if (hierarchyObject && typeof hierarchyObject === 'object' && !Array.isArray(hierarchyObject)) {
    const level1 = String(hierarchyObject.level1 || hierarchyObject.level_1 || '').trim()
    const level2 = String(hierarchyObject.level2 || hierarchyObject.level_2 || '').trim()
    if (level1 && level2) return [level1, level2]
  }

  const fields = settings?.fields && typeof settings.fields === 'object' ? settings.fields : {}
  if (Object.prototype.hasOwnProperty.call(fields, 'level_1') && Object.prototype.hasOwnProperty.call(fields, 'level_2')) {
    return ['level_1', 'level_2']
  }
  if (Object.prototype.hasOwnProperty.call(fields, 'level1') && Object.prototype.hasOwnProperty.call(fields, 'level2')) {
    return ['level1', 'level2']
  }

  return []
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
