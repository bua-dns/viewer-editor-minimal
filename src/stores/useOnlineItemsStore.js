import { ref } from 'vue'
import {
  fetchCollectionFieldValuesFromStrapi,
  fetchAllCollectionItemsFromStrapi,
  getWikidataAutosuggestFieldKeysFromSettings,
  normalizeStrapiItem,
  resolveItemsPathFromSettings,
  resolveScanFieldFromSettings,
} from '../services/strapiApi'
import { resolveSearchableFieldKeys, searchCollectionItemsInStrapi } from '../services/strapiSearch'
import { tokenizeSearchQuery } from '../domain/searchQuery'
import {
  buildHierarchyLevel1OptionsFromValues,
  normalizeHierarchyValue,
  resolveFirstLevelStaticList,
  resolveHierarchyFieldsFromSettings,
} from '../domain/hierarchyConfig'
import { useAuthStore } from './useAuthStore'
import { useConnectionProfileStore } from './useConnectionProfileStore'

const items = ref([])
const itemsStatus = ref('idle')
const lastItemsError = ref('')
const activeItemsPath = ref('')
const hierarchyFields = ref([])
const hierarchyLevel1Options = ref([])
const selectedHierarchyLevel1Value = ref('')

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

function failItemsLoad(message) {
  itemsStatus.value = 'error'
  lastItemsError.value = message
  return { ok: false, error: message }
}

function failItemsLoadWithError(error) {
  items.value = []
  const message = typeof error?.message === 'string' ? error.message.trim() : ''
  return failItemsLoad(message || 'Could not load online items.')
}

/**
 * What every item load needs: the request base (profile, path, token, populate keys) and how a
 * Strapi row becomes an app item. Returns `{ error }` when the connection or settings are incomplete.
 */
function resolveItemsLoadContext(settings) {
  const { connectionProfile } = useConnectionProfileStore()
  const { token } = useAuthStore()

  if (!connectionProfile.value) return { error: 'No saved connection profile found.' }

  const itemsPath = resolveItemsPathFromSettings(settings)
  if (!itemsPath) return { error: 'Online settings must provide itemsPath.' }

  const settingsFields = settings?.fields && typeof settings.fields === 'object' ? settings.fields : {}
  const scanFieldKey = resolveScanFieldFromSettings(settings)

  return {
    itemsPath,
    fetchRequest: {
      profile: connectionProfile.value,
      itemsPath,
      token: token.value || '',
      populateFields: getWikidataAutosuggestFieldKeysFromSettings(settings),
    },
    normalizeRow: (rawRow) => normalizeStrapiItem(rawRow, settingsFields, itemsPath, scanFieldKey),
  }
}

function startItemsLoad(itemsPath, normalizedHierarchyFields) {
  itemsStatus.value = 'loading'
  lastItemsError.value = ''
  activeItemsPath.value = itemsPath
  hierarchyFields.value = normalizedHierarchyFields
}

async function loadHierarchyLevel1Options(context, normalizedHierarchyFields, firstLevelStaticList) {
  if (firstLevelStaticList.length > 0) {
    return buildHierarchyLevel1OptionsFromStaticList(firstLevelStaticList)
  }
  const { profile, itemsPath, token } = context.fetchRequest
  const level1Values = await fetchCollectionFieldValuesFromStrapi({
    profile,
    itemsPath,
    token,
    fieldKey: normalizedHierarchyFields[0],
  })
  return buildHierarchyLevel1OptionsFromValues(level1Values)
}

async function fetchOnlineItems({ settings }) {
  const context = resolveItemsLoadContext(settings)
  if (context.error) return failItemsLoad(context.error)

  const { itemsPath } = context
  const normalizedHierarchyFields = resolveHierarchyFieldsFromSettings(settings)

  startItemsLoad(itemsPath, normalizedHierarchyFields)
  hierarchyLevel1Options.value = []
  selectedHierarchyLevel1Value.value = ''

  try {
    if (normalizedHierarchyFields.length >= 2) {
      // With a hierarchy only the level-1 boxes are loaded; the items follow per box.
      hierarchyLevel1Options.value = await loadHierarchyLevel1Options(
        context,
        normalizedHierarchyFields,
        resolveFirstLevelStaticList(settings),
      )
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

    const fetchedRows = await fetchAllCollectionItemsFromStrapi(context.fetchRequest)
    items.value = fetchedRows.map(context.normalizeRow)
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
    return failItemsLoadWithError(error)
  }
}

/**
 * Loads the items without a level-1 value, filtered on the server (null or empty string). If the
 * server rejects that filter (e.g. for a non-text field type), falls back to loading the whole
 * collection; the caller filters on the client either way.
 */
async function fetchUnassignedLevel1Rows(fetchRequest, level1FieldKey) {
  try {
    return await fetchAllCollectionItemsFromStrapi({ ...fetchRequest, filterEmptyField: level1FieldKey })
  } catch (error) {
    if (error?.status !== 400) throw error
    return fetchAllCollectionItemsFromStrapi(fetchRequest)
  }
}

function fetchLevel1Rows(fetchRequest, level1FieldKey, level1Value) {
  if (!level1Value) return fetchUnassignedLevel1Rows(fetchRequest, level1FieldKey)
  return fetchAllCollectionItemsFromStrapi({ ...fetchRequest, filtersEq: { [level1FieldKey]: level1Value } })
}

async function fetchOnlineItemsForHierarchyLevel1({ settings, level1Value }) {
  const context = resolveItemsLoadContext(settings)
  if (context.error) return failItemsLoad(context.error)

  const normalizedHierarchyFields = resolveHierarchyFieldsFromSettings(settings)
  if (normalizedHierarchyFields.length < 2) {
    return fetchOnlineItems({ settings })
  }

  const { itemsPath } = context
  const normalizedLevel1Value = normalizeHierarchyValue(level1Value)
  const level1FieldKey = normalizedHierarchyFields[0]

  startItemsLoad(itemsPath, normalizedHierarchyFields)

  try {
    const fetchedRows = await fetchLevel1Rows(context.fetchRequest, level1FieldKey, normalizedLevel1Value)

    // The client filter stays as a safety net (e.g. whitespace-only values count as unassigned).
    items.value = fetchedRows
      .map(context.normalizeRow)
      .filter((item) => normalizeHierarchyValue(item?.[level1FieldKey]) === normalizedLevel1Value)
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
    return failItemsLoadWithError(error)
  }
}

/**
 * Searches the whole collection on the server (all level-1 groups) and replaces the items with the
 * hits. The selected level-1 value is kept, so the caller can return to that group afterwards.
 * `loadExcludedFieldKeys()` resolves to fields not to search (the structured fields of the data
 * model, which take no text filter); it runs only for a valid query. These fields are reported in
 * `droppedFieldKeys` together with the fields Strapi refused.
 */
async function searchOnlineItems({ settings, query, loadExcludedFieldKeys = async () => [] }) {
  const tokens = tokenizeSearchQuery(query)
  if (!tokens.length) return failItemsLoad('The search needs at least three characters.')

  const context = resolveItemsLoadContext(settings)
  if (context.error) return failItemsLoad(context.error)

  const normalizedHierarchyFields = resolveHierarchyFieldsFromSettings(settings)
  startItemsLoad(context.itemsPath, normalizedHierarchyFields)

  try {
    const excluded = new Set(await loadExcludedFieldKeys())
    const candidateFieldKeys = resolveSearchableFieldKeys(settings, normalizedHierarchyFields)
    const skippedFieldKeys = candidateFieldKeys.filter((fieldKey) => excluded.has(fieldKey))

    const { rows, droppedFieldKeys } = await searchCollectionItemsInStrapi({
      ...context.fetchRequest,
      tokens,
      fieldKeys: candidateFieldKeys.filter((fieldKey) => !excluded.has(fieldKey)),
    })
    items.value = rows.map(context.normalizeRow)
    itemsStatus.value = 'ready'
    return {
      ok: true,
      items: items.value,
      itemsPath: context.itemsPath,
      droppedFieldKeys: [...skippedFieldKeys, ...droppedFieldKeys],
    }
  } catch (error) {
    return failItemsLoadWithError(error)
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
    searchOnlineItems,
  }
}
