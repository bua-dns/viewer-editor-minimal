import { ref } from 'vue'
import {
  fetchCollectionFieldValuesFromStrapi,
  fetchAllCollectionItemsFromStrapi,
  getWikidataAutosuggestFieldKeysFromSettings,
  normalizeStrapiItem,
  resolveItemsPathFromSettings,
  resolveScanFieldFromSettings,
} from '../services/strapiApi'
import { useAuthStore } from './useAuthStore'
import { useConnectionProfileStore } from './useConnectionProfileStore'

const items = ref([])
const itemsStatus = ref('idle')
const lastItemsError = ref('')
const activeItemsPath = ref('')
const hierarchyFields = ref([])
const hierarchyLevel1Options = ref([])
const selectedHierarchyLevel1Value = ref('')

function normalizeHierarchyValue(value) {
  if (value == null) return ''
  return String(value).trim()
}

function normalizeHierarchyFields(settings) {
  const candidateArrays = [
    settings?.hierarchyFields,
    settings?.hierarchy_fields,
    settings?.hierarchicalFields,
    settings?.hierarchy?.fields,
    settings?.config?.hierarchyFields,
    settings?.config?.hierarchy_fields,
  ]

  let source = candidateArrays.find((entry) => Array.isArray(entry)) || []
  if (!source.length) {
    const objectShape =
      settings?.hierarchy && typeof settings.hierarchy === 'object' && !Array.isArray(settings.hierarchy)
        ? settings.hierarchy
        : null
    if (objectShape) {
      const level1 = String(objectShape.level1 || objectShape.level_1 || '').trim()
      const level2 = String(objectShape.level2 || objectShape.level_2 || '').trim()
      if (level1 && level2) {
        source = [level1, level2]
      }
    }
  }

  if (!source.length) {
    const candidateString = [
      settings?.hierarchyFields,
      settings?.hierarchy_fields,
      settings?.hierarchicalFields,
    ].find((entry) => typeof entry === 'string')

    if (typeof candidateString === 'string' && candidateString.trim()) {
      source = candidateString.split(',')
    }
  }

  const normalized = (Array.isArray(source) ? source : [])
    .map((entry) => String(entry || '').trim())
    .filter(Boolean)

  if (normalized.length >= 2) {
    return Array.from(new Set(normalized))
  }

  const fields = settings?.fields && typeof settings.fields === 'object' ? settings.fields : {}
  const hasSnakeCaseLevels =
    Object.prototype.hasOwnProperty.call(fields, 'level_1') &&
    Object.prototype.hasOwnProperty.call(fields, 'level_2')
  if (hasSnakeCaseLevels) {
    return ['level_1', 'level_2']
  }

  const hasCamelCaseLevels =
    Object.prototype.hasOwnProperty.call(fields, 'level1') &&
    Object.prototype.hasOwnProperty.call(fields, 'level2')
  if (hasCamelCaseLevels) {
    return ['level1', 'level2']
  }

  return Array.from(new Set(normalized))
}

function normalizeFirstLevelStaticList(settings) {
  const candidateLists = [
    settings?.firstLevelStaticList,
    settings?.first_level_static_list,
    settings?.hierarchy?.firstLevelStaticList,
    settings?.config?.firstLevelStaticList,
  ]

  const source = candidateLists.find((entry) => Array.isArray(entry)) || []
  return source
    .map((entry) => normalizeHierarchyValue(entry))
    .filter(Boolean)
    .filter((value, index, list) => list.indexOf(value) === index)
}

function buildHierarchyLevel1Options(values) {
  const countsByValue = new Map()
  ;(Array.isArray(values) ? values : []).forEach((value) => {
    const normalized = normalizeHierarchyValue(value)
    countsByValue.set(normalized, (countsByValue.get(normalized) || 0) + 1)
  })

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

function buildHierarchyLevel1OptionsFromStaticList(values) {
  return (Array.isArray(values) ? values : []).map((value) => ({
    value: normalizeHierarchyValue(value),
    count: null,
    isUnassigned: false,
  }))
}

function clearOnlineItems() {
  items.value = []
  itemsStatus.value = 'idle'
  lastItemsError.value = ''
  activeItemsPath.value = ''
  hierarchyFields.value = []
  hierarchyLevel1Options.value = []
  selectedHierarchyLevel1Value.value = ''
}

async function fetchOnlineItems({ settings }) {
  const { connectionProfile } = useConnectionProfileStore()
  const { token } = useAuthStore()

  if (!connectionProfile.value) {
    itemsStatus.value = 'error'
    lastItemsError.value = 'No saved connection profile found.'
    return { ok: false, error: lastItemsError.value }
  }

  const itemsPath = resolveItemsPathFromSettings(settings)
  if (!itemsPath) {
    itemsStatus.value = 'error'
    lastItemsError.value = 'Online settings must provide itemsPath.'
    return { ok: false, error: lastItemsError.value }
  }

  const settingsFields = settings?.fields && typeof settings.fields === 'object' ? settings.fields : {}
  const scanFieldKey = resolveScanFieldFromSettings(settings)
  const populateFields = getWikidataAutosuggestFieldKeysFromSettings(settings)
  const normalizedHierarchyFields = normalizeHierarchyFields(settings)
  const firstLevelStaticList = normalizeFirstLevelStaticList(settings)

  itemsStatus.value = 'loading'
  lastItemsError.value = ''
  activeItemsPath.value = itemsPath
  hierarchyFields.value = normalizedHierarchyFields
  hierarchyLevel1Options.value = []
  selectedHierarchyLevel1Value.value = ''

  try {
    if (normalizedHierarchyFields.length >= 2) {
      if (firstLevelStaticList.length > 0) {
        hierarchyLevel1Options.value = buildHierarchyLevel1OptionsFromStaticList(firstLevelStaticList)
        items.value = []
        itemsStatus.value = 'ready'

        return {
          ok: true,
          items: [],
          itemsPath,
          hierarchyEnabled: true,
          hierarchyFields: normalizedHierarchyFields,
          hierarchyLevel1Options: hierarchyLevel1Options.value,
        }
      }

      const level1FieldKey = normalizedHierarchyFields[0]
      const level1Values = await fetchCollectionFieldValuesFromStrapi({
        profile: connectionProfile.value,
        itemsPath,
        token: token.value || '',
        fieldKey: level1FieldKey,
      })

      hierarchyLevel1Options.value = buildHierarchyLevel1Options(level1Values)
      items.value = []
      itemsStatus.value = 'ready'

      return {
        ok: true,
        items: [],
        itemsPath,
        hierarchyEnabled: true,
        hierarchyFields: normalizedHierarchyFields,
        hierarchyLevel1Options: hierarchyLevel1Options.value,
      }
    }

    const fetchedRows = await fetchAllCollectionItemsFromStrapi({
      profile: connectionProfile.value,
      itemsPath,
      token: token.value || '',
      populateFields,
    })

    items.value = fetchedRows.map((rawRow) =>
      normalizeStrapiItem(rawRow, settingsFields, itemsPath, scanFieldKey),
    )
    itemsStatus.value = 'ready'
    return {
      ok: true,
      items: items.value,
      itemsPath,
      hierarchyEnabled: false,
      hierarchyFields: normalizedHierarchyFields,
      hierarchyLevel1Options: [],
    }
  } catch (error) {
    items.value = []
    itemsStatus.value = 'error'
    lastItemsError.value =
      typeof error?.message === 'string' && error.message.trim()
        ? error.message.trim()
        : 'Could not load online items.'
    return { ok: false, error: lastItemsError.value }
  }
}

async function fetchOnlineItemsForHierarchyLevel1({ settings, level1Value }) {
  const { connectionProfile } = useConnectionProfileStore()
  const { token } = useAuthStore()

  if (!connectionProfile.value) {
    itemsStatus.value = 'error'
    lastItemsError.value = 'No saved connection profile found.'
    return { ok: false, error: lastItemsError.value }
  }

  const itemsPath = resolveItemsPathFromSettings(settings)
  if (!itemsPath) {
    itemsStatus.value = 'error'
    lastItemsError.value = 'Online settings must provide itemsPath.'
    return { ok: false, error: lastItemsError.value }
  }

  const normalizedHierarchyFields = normalizeHierarchyFields(settings)
  if (normalizedHierarchyFields.length < 2) {
    return fetchOnlineItems({ settings })
  }

  const settingsFields = settings?.fields && typeof settings.fields === 'object' ? settings.fields : {}
  const scanFieldKey = resolveScanFieldFromSettings(settings)
  const populateFields = getWikidataAutosuggestFieldKeysFromSettings(settings)
  const normalizedLevel1Value = normalizeHierarchyValue(level1Value)
  const level1FieldKey = normalizedHierarchyFields[0]

  itemsStatus.value = 'loading'
  lastItemsError.value = ''
  activeItemsPath.value = itemsPath
  hierarchyFields.value = normalizedHierarchyFields

  try {
    const hasExplicitLevel1Value = normalizedLevel1Value.length > 0
    const fetchedRows = await fetchAllCollectionItemsFromStrapi({
      profile: connectionProfile.value,
      itemsPath,
      token: token.value || '',
      populateFields,
      filtersEq: hasExplicitLevel1Value ? { [level1FieldKey]: normalizedLevel1Value } : {},
    })

    const normalizedItems = fetchedRows
      .map((rawRow) => normalizeStrapiItem(rawRow, settingsFields, itemsPath, scanFieldKey))
      .filter((item) => {
        const currentValue = normalizeHierarchyValue(item?.[level1FieldKey])
        if (hasExplicitLevel1Value) {
          return currentValue === normalizedLevel1Value
        }
        return currentValue.length === 0
      })

    items.value = normalizedItems
    selectedHierarchyLevel1Value.value = normalizedLevel1Value
    itemsStatus.value = 'ready'

    return {
      ok: true,
      items: items.value,
      itemsPath,
      selectedLevel1Value: normalizedLevel1Value,
      hierarchyEnabled: true,
      hierarchyFields: normalizedHierarchyFields,
      hierarchyLevel1Options: hierarchyLevel1Options.value,
    }
  } catch (error) {
    items.value = []
    itemsStatus.value = 'error'
    lastItemsError.value =
      typeof error?.message === 'string' && error.message.trim()
        ? error.message.trim()
        : 'Could not load online items.'
    return { ok: false, error: lastItemsError.value }
  }
}

export function useOnlineItemsStore() {
  return {
    items,
    itemsStatus,
    lastItemsError,
    activeItemsPath,
    hierarchyFields,
    hierarchyLevel1Options,
    selectedHierarchyLevel1Value,
    clearOnlineItems,
    fetchOnlineItems,
    fetchOnlineItemsForHierarchyLevel1,
  }
}
