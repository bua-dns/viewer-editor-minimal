import { computed, ref } from 'vue'
import {
  createCollectionItemInStrapi,
  fetchAllCollectionItemsFromStrapi,
  getWikidataAutosuggestFieldKeysFromSettings,
  normalizeOnlineChangedFieldsForStrapi,
  normalizeStrapiItem,
  pickNonEmptyOnlineFields,
  resolveItemsPathFromSettings,
  resolveScanFieldFromSettings,
  resolveStableIdentifierFromRow,
  updateCollectionItemInStrapi,
} from '../services/strapiApi'
import { computeReplacementChangesForItem } from '../composables/replacementRules'
import { useOnlineSettingsStore } from './useOnlineSettingsStore'

const ONLINE_META_KEY = '__onlineMeta'

const pendingUpdatesById = ref({})
const pendingCreatesById = ref({})
const saveStatus = ref('idle')
const lastSaveError = ref('')

function cloneValue(value) {
  if (value === undefined) return undefined
  return JSON.parse(JSON.stringify(value))
}

function createEntryKey(itemsPath, id) {
  return `${String(itemsPath || '')}::${String(id || '')}`
}

function isEqualValue(left, right) {
  return JSON.stringify(left) === JSON.stringify(right)
}

function clearSaveFeedback() {
  if (saveStatus.value === 'success' || saveStatus.value === 'error') {
    saveStatus.value = 'idle'
  }
  lastSaveError.value = ''
}

function clearOnlineUpdates() {
  pendingUpdatesById.value = {}
  pendingCreatesById.value = {}
  saveStatus.value = 'idle'
  lastSaveError.value = ''
}

function trackOnlineDraftCreate({ item }) {
  const onlineMeta = item?.[ONLINE_META_KEY]
  if (!onlineMeta || typeof onlineMeta !== 'object') return false
  if (onlineMeta.isDraft !== true) return false

  const draftId = String(onlineMeta.draftId || '').trim()
  const itemsPath = String(onlineMeta.itemsPath || '').trim()
  if (!draftId || !itemsPath) return false

  clearSaveFeedback()

  const entryKey = createEntryKey(itemsPath, draftId)
  const currentEntry = pendingCreatesById.value[entryKey] || {
    draftId,
    itemsPath,
    item,
    changedFields: {},
  }
  currentEntry.item = item

  pendingCreatesById.value = {
    ...pendingCreatesById.value,
    [entryKey]: currentEntry,
  }
  return true
}

function trackOnlineDraftFieldChange({ item, onlineMeta, key, nextValue }) {
  const draftId = String(onlineMeta.draftId || '').trim()
  const itemsPath = String(onlineMeta.itemsPath || '').trim()
  if (!draftId || !itemsPath) return false

  clearSaveFeedback()

  const entryKey = createEntryKey(itemsPath, draftId)
  const currentEntry = pendingCreatesById.value[entryKey] || {
    draftId,
    itemsPath,
    item,
    changedFields: {},
  }
  currentEntry.item = item
  currentEntry.changedFields[key] = cloneValue(nextValue)

  pendingCreatesById.value = {
    ...pendingCreatesById.value,
    [entryKey]: currentEntry,
  }
  return true
}

function trackOnlineFieldChange({ item, snapshotItem, key, nextValue }) {
  if (key === ONLINE_META_KEY) return false
  const onlineMeta = item?.[ONLINE_META_KEY]
  if (!onlineMeta || typeof onlineMeta !== 'object') return false

  if (onlineMeta.isDraft === true) {
    return trackOnlineDraftFieldChange({ item, onlineMeta, key, nextValue })
  }

  const id = onlineMeta.id
  const itemsPath = onlineMeta.itemsPath
  if (!id || !itemsPath) return false

  clearSaveFeedback()

  const entryKey = createEntryKey(itemsPath, id)
  const currentEntry = pendingUpdatesById.value[entryKey] || {
    id,
    itemsPath,
    changedFields: {},
  }

  const baselineValue = snapshotItem?.[key]
  if (isEqualValue(nextValue, baselineValue)) {
    delete currentEntry.changedFields[key]
  } else {
    currentEntry.changedFields[key] = cloneValue(nextValue)
  }

  if (Object.keys(currentEntry.changedFields).length === 0) {
    const nextEntries = { ...pendingUpdatesById.value }
    delete nextEntries[entryKey]
    pendingUpdatesById.value = nextEntries
    return true
  }

  pendingUpdatesById.value = {
    ...pendingUpdatesById.value,
    [entryKey]: currentEntry,
  }
  return true
}

/**
 * Extends a replacements run to the whole collection: every item that is not
 * currently loaded is fetched, matched against the rules and — when it changes —
 * registered as a regular pending update, so it is written by the normal save.
 */
async function trackOnlineReplacementUpdatesForRemainingItems({
  profile,
  token = '',
  settings,
  replacements,
  fieldConfigs,
  loadedIds = [],
}) {
  const itemsPath = resolveItemsPathFromSettings(settings)
  if (!itemsPath) {
    return { ok: false, error: 'Online settings must provide itemsPath.' }
  }

  const settingsFields = settings?.fields && typeof settings.fields === 'object' ? settings.fields : {}
  const scanFieldKey = resolveScanFieldFromSettings(settings)
  const populateFields = getWikidataAutosuggestFieldKeysFromSettings(settings)
  const skippedIds = new Set(loadedIds.map((id) => String(id)))

  let changedItemCount = 0
  let changedFieldCount = 0

  try {
    const fetchedRows = await fetchAllCollectionItemsFromStrapi({
      profile,
      itemsPath,
      token,
      populateFields,
    })

    fetchedRows.forEach((rawRow) => {
      const item = normalizeStrapiItem(rawRow, settingsFields, itemsPath, scanFieldKey)
      const id = item?.[ONLINE_META_KEY]?.id
      if (!id || skippedIds.has(String(id))) return

      const changedFields = computeReplacementChangesForItem(item, replacements, fieldConfigs)
      const changedKeys = Object.keys(changedFields)
      if (!changedKeys.length) return

      const snapshotItem = { ...item }
      changedKeys.forEach((key) => {
        item[key] = changedFields[key]
        trackOnlineFieldChange({ item, snapshotItem, key, nextValue: changedFields[key] })
      })

      changedItemCount += 1
      changedFieldCount += changedKeys.length
    })

    return {
      ok: true,
      scannedCount: fetchedRows.length,
      skippedCount: skippedIds.size,
      changedItemCount,
      changedFieldCount,
    }
  } catch (error) {
    return {
      ok: false,
      error: normalizeSaveErrorMessage(error, 'Could not load the collection for the replacements run.'),
      changedItemCount,
      changedFieldCount,
    }
  }
}

function removePendingUpdate(entryKey) {
  if (!Object.prototype.hasOwnProperty.call(pendingUpdatesById.value, entryKey)) return
  const nextEntries = { ...pendingUpdatesById.value }
  delete nextEntries[entryKey]
  pendingUpdatesById.value = nextEntries
}

function removePendingCreate(entryKey) {
  if (!Object.prototype.hasOwnProperty.call(pendingCreatesById.value, entryKey)) return
  const nextEntries = { ...pendingCreatesById.value }
  delete nextEntries[entryKey]
  pendingCreatesById.value = nextEntries
}

function normalizeSaveErrorMessage(error, fallback) {
  return typeof error?.message === 'string' && error.message.trim()
    ? error.message.trim()
    : fallback
}

async function saveOnlineUpdates({ profile, token = '' }) {
  const { settings } = useOnlineSettingsStore()
  const fieldConfigs = settings.value?.fields && typeof settings.value.fields === 'object'
    ? settings.value.fields
    : {}

  const updateEntries = Object.entries(pendingUpdatesById.value)
  const createEntries = Object.entries(pendingCreatesById.value)
  if (!updateEntries.length && !createEntries.length) {
    saveStatus.value = 'idle'
    lastSaveError.value = ''
    return { ok: true, savedCount: 0, failedCount: 0 }
  }

  saveStatus.value = 'saving'
  lastSaveError.value = ''

  const failed = []
  const createdItems = []
  let savedCount = 0

  for (const [entryKey, entry] of createEntries) {
    try {
      const createFields = pickNonEmptyOnlineFields(
        normalizeOnlineChangedFieldsForStrapi(entry.changedFields, fieldConfigs),
      )
      const payload = await createCollectionItemInStrapi({
        profile,
        itemsPath: entry.itemsPath,
        token,
        fields: createFields,
      })
      const createdRow = payload?.data && typeof payload.data === 'object' ? payload.data : null
      const stableIdentifier = resolveStableIdentifierFromRow(createdRow)
      if (!stableIdentifier) {
        throw new Error('Create response does not contain a stable identifier (documentId or id).')
      }

      const draftItem = entry.item
      if (draftItem && typeof draftItem === 'object') {
        draftItem[ONLINE_META_KEY] = {
          id: stableIdentifier.id,
          idKind: stableIdentifier.idKind,
          idValue: stableIdentifier.id,
          itemsPath: entry.itemsPath,
          updatedAt: createdRow?.updatedAt,
        }
        createdItems.push(draftItem)
      }

      removePendingCreate(entryKey)
      savedCount += 1
    } catch (error) {
      failed.push({
        entryKey,
        id: entry.draftId,
        error: normalizeSaveErrorMessage(error, 'Could not create online item.'),
      })
    }
  }

  for (const [entryKey, entry] of updateEntries) {
    try {
      const changedFields = normalizeOnlineChangedFieldsForStrapi(entry.changedFields, fieldConfigs)
      await updateCollectionItemInStrapi({
        profile,
        itemsPath: entry.itemsPath,
        id: entry.id,
        token,
        changedFields,
      })
      removePendingUpdate(entryKey)
      savedCount += 1
    } catch (error) {
      failed.push({
        entryKey,
        id: entry.id,
        error: normalizeSaveErrorMessage(error, 'Could not save online changes.'),
      })
    }
  }

  if (!failed.length) {
    saveStatus.value = 'success'
    lastSaveError.value = ''
    return { ok: true, savedCount, failedCount: 0, createdItems }
  }

  saveStatus.value = 'error'
  lastSaveError.value = `${failed.length} update(s) failed. ${failed[0].error}`
  return {
    ok: false,
    savedCount,
    failedCount: failed.length,
    failed,
    createdItems,
    error: lastSaveError.value,
  }
}

const pendingUpdateCount = computed(
  () => Object.keys(pendingUpdatesById.value).length + Object.keys(pendingCreatesById.value).length,
)
const hasPendingUpdates = computed(() => pendingUpdateCount.value > 0)

export function useOnlineUpdatesStore() {
  return {
    pendingUpdatesById,
    pendingCreatesById,
    pendingUpdateCount,
    hasPendingUpdates,
    saveStatus,
    lastSaveError,
    clearOnlineUpdates,
    clearSaveFeedback,
    trackOnlineDraftCreate,
    trackOnlineFieldChange,
    trackOnlineReplacementUpdatesForRemainingItems,
    saveOnlineUpdates,
  }
}
