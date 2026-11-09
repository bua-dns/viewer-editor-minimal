import { computed, ref } from 'vue'
import {
  createCollectionItemInStrapi,
  fetchAllCollectionItemsFromStrapi,
  fetchCollectionItemFromStrapi,
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
import { findConflictingFields } from '../composables/onlineSaveConflicts'
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

function resolveDraftEntry(item) {
  const onlineMeta = item?.[ONLINE_META_KEY]
  const draftId = String(onlineMeta?.draftId || '').trim()
  const itemsPath = String(onlineMeta?.itemsPath || '').trim()
  if (!draftId || !itemsPath) return null

  const entryKey = createEntryKey(itemsPath, draftId)
  const entry = pendingCreatesById.value[entryKey] || { draftId, itemsPath, item, changedFields: {} }
  entry.item = item
  return { entryKey, entry }
}

function setPendingCreate(entryKey, entry) {
  pendingCreatesById.value = {
    ...pendingCreatesById.value,
    [entryKey]: entry,
  }
}

function trackOnlineDraftCreate({ item }) {
  if (item?.[ONLINE_META_KEY]?.isDraft !== true) return false

  const draft = resolveDraftEntry(item)
  if (!draft) return false

  clearSaveFeedback()
  setPendingCreate(draft.entryKey, draft.entry)
  return true
}

function trackOnlineDraftFieldChange({ item, key, nextValue }) {
  const draft = resolveDraftEntry(item)
  if (!draft) return false

  clearSaveFeedback()
  draft.entry.changedFields[key] = cloneValue(nextValue)
  setPendingCreate(draft.entryKey, draft.entry)
  return true
}

// `baselineFields` holds the server value each changed field had when it was loaded; the save
// compares it with the current server value to detect edits made by someone else meanwhile.
function createUpdateEntry({ id, itemsPath, item = null }) {
  return { id, itemsPath, item, changedFields: {}, baselineFields: {} }
}

function setPendingUpdate(entryKey, entry) {
  pendingUpdatesById.value = {
    ...pendingUpdatesById.value,
    [entryKey]: entry,
  }
}

function recordFieldChange(entry, key, nextValue, baselineValue) {
  if (isEqualValue(nextValue, baselineValue)) {
    delete entry.changedFields[key]
    delete entry.baselineFields[key]
    return
  }
  entry.changedFields[key] = cloneValue(nextValue)
  if (!Object.prototype.hasOwnProperty.call(entry.baselineFields, key)) {
    entry.baselineFields[key] = cloneValue(baselineValue)
  }
}

function trackOnlineFieldChange({ item, snapshotItem, key, nextValue }) {
  if (key === ONLINE_META_KEY) return false
  const onlineMeta = item?.[ONLINE_META_KEY]
  if (!onlineMeta || typeof onlineMeta !== 'object') return false

  if (onlineMeta.isDraft === true) {
    return trackOnlineDraftFieldChange({ item, key, nextValue })
  }

  const { id, itemsPath } = onlineMeta
  if (!id || !itemsPath) return false

  clearSaveFeedback()

  const entryKey = createEntryKey(itemsPath, id)
  const currentEntry = pendingUpdatesById.value[entryKey] || createUpdateEntry({ id, itemsPath })
  currentEntry.item = item
  recordFieldChange(currentEntry, key, nextValue, snapshotItem?.[key])

  if (Object.keys(currentEntry.changedFields).length === 0) {
    removePendingUpdate(entryKey)
  } else {
    setPendingUpdate(entryKey, currentEntry)
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

// A key missing from `changedFields` was reverted meanwhile; the item then holds the wanted value.
function readCurrentValue(entry, key, sentValue) {
  if (Object.prototype.hasOwnProperty.call(entry.changedFields, key)) return entry.changedFields[key]
  const hasItem = entry.item && typeof entry.item === 'object'
  return hasItem ? entry.item[key] : sentValue
}

/**
 * After a successful write, drops the fields that were sent and still hold the sent value. A
 * field edited (or reverted) while the request was running stays pending, with the sent value
 * as baseline, because that is what the server holds now.
 */
function settleSentFields(entry, sentFields) {
  Object.entries(sentFields).forEach(([key, sentValue]) => {
    const currentValue = readCurrentValue(entry, key, sentValue)
    if (isEqualValue(currentValue, sentValue)) {
      delete entry.changedFields[key]
      delete entry.baselineFields[key]
      return
    }
    entry.changedFields[key] = cloneValue(currentValue)
    entry.baselineFields[key] = cloneValue(sentValue)
  })
}

function buildSaveContext({ profile, token }) {
  const { settings } = useOnlineSettingsStore()
  const currentSettings = settings.value && typeof settings.value === 'object' ? settings.value : {}
  const fieldConfigs = currentSettings.fields && typeof currentSettings.fields === 'object'
    ? currentSettings.fields
    : {}

  return {
    profile,
    token,
    fieldConfigs,
    scanFieldKey: resolveScanFieldFromSettings(currentSettings),
    wikidataFieldKeys: getWikidataAutosuggestFieldKeysFromSettings(currentSettings),
  }
}

async function loadServerItem(context, entry, fieldKeys) {
  const row = await fetchCollectionItemFromStrapi({
    profile: context.profile,
    itemsPath: entry.itemsPath,
    token: context.token,
    id: entry.id,
    populateFields: fieldKeys.filter((key) => context.wikidataFieldKeys.includes(key)),
  })
  const knownFields = { ...Object.fromEntries(fieldKeys.map((key) => [key, {}])), ...context.fieldConfigs }
  return normalizeStrapiItem(row, knownFields, entry.itemsPath, context.scanFieldKey)
}

/**
 * Refuses to overwrite fields that someone else changed since they were loaded. The conflicting
 * server values become the new baseline, so saving again overwrites them deliberately.
 */
async function assertNoConflicts(context, entry, sentFields) {
  const serverItem = await loadServerItem(context, entry, Object.keys(sentFields))
  const conflictingKeys = findConflictingFields({
    sentFields,
    baselineFields: entry.baselineFields,
    serverItem,
  })
  if (!conflictingKeys.length) return

  conflictingKeys.forEach((key) => {
    entry.baselineFields[key] = cloneValue(serverItem[key])
  })
  throw new Error(
    `Item ${entry.id}: ${conflictingKeys.join(', ')} changed on the server since loading. `
      + 'Reload to see the other version, or save again to overwrite it.',
  )
}

async function saveUpdateEntry(context, entryKey, entry) {
  const sentFields = cloneValue(entry.changedFields)
  await assertNoConflicts(context, entry, sentFields)

  await updateCollectionItemInStrapi({
    profile: context.profile,
    itemsPath: entry.itemsPath,
    id: entry.id,
    token: context.token,
    changedFields: normalizeOnlineChangedFieldsForStrapi(sentFields, context.fieldConfigs),
  })

  // Edits during the request may have replaced the entry (e.g. revert, then another edit).
  const liveEntry = pendingUpdatesById.value[entryKey] || entry
  settleSentFields(liveEntry, sentFields)
  if (Object.keys(liveEntry.changedFields).length === 0) {
    removePendingUpdate(entryKey)
  } else {
    setPendingUpdate(entryKey, liveEntry)
  }
  return null
}

function assignCreatedIdentity(entry, createdRow, stableIdentifier) {
  entry.item[ONLINE_META_KEY] = {
    id: stableIdentifier.id,
    idKind: stableIdentifier.idKind,
    idValue: stableIdentifier.id,
    itemsPath: entry.itemsPath,
    updatedAt: createdRow?.updatedAt,
  }
}

// Fields edited while the create request was running become a regular update of the new item.
function carryOverEditsMadeDuringCreate(entry, sentFields, stableIdentifier) {
  const leftover = createUpdateEntry({ id: stableIdentifier.id, itemsPath: entry.itemsPath, item: entry.item })
  leftover.changedFields = cloneValue(entry.changedFields)
  settleSentFields(leftover, sentFields)
  if (!Object.keys(leftover.changedFields).length) return
  setPendingUpdate(createEntryKey(entry.itemsPath, stableIdentifier.id), leftover)
}

async function saveCreateEntry(context, entryKey, entry) {
  const sentFields = cloneValue(entry.changedFields)
  const payload = await createCollectionItemInStrapi({
    profile: context.profile,
    itemsPath: entry.itemsPath,
    token: context.token,
    fields: pickNonEmptyOnlineFields(normalizeOnlineChangedFieldsForStrapi(sentFields, context.fieldConfigs)),
  })
  const createdRow = payload?.data && typeof payload.data === 'object' ? payload.data : null
  const stableIdentifier = resolveStableIdentifierFromRow(createdRow)
  if (!stableIdentifier) {
    throw new Error('Create response does not contain a stable identifier (documentId or id).')
  }

  removePendingCreate(entryKey)
  const hasItem = entry.item && typeof entry.item === 'object'
  if (!hasItem) return null

  assignCreatedIdentity(entry, createdRow, stableIdentifier)
  carryOverEditsMadeDuringCreate(entry, sentFields, stableIdentifier)
  return entry.item
}

async function saveEntries(entries, saveEntry, fallbackError) {
  const results = { savedCount: 0, failed: [], savedItems: [] }
  for (const [entryKey, entry] of entries) {
    try {
      const savedItem = await saveEntry(entryKey, entry)
      if (savedItem) results.savedItems.push(savedItem)
      results.savedCount += 1
    } catch (error) {
      results.failed.push({
        entryKey,
        id: entry.id ?? entry.draftId,
        error: normalizeSaveErrorMessage(error, fallbackError),
      })
    }
  }
  return results
}

function finishSave({ savedCount, failed, createdItems }) {
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

async function saveOnlineUpdates({ profile, token = '' }) {
  const createEntries = Object.entries(pendingCreatesById.value)
  const updateEntries = Object.entries(pendingUpdatesById.value)
  if (!updateEntries.length && !createEntries.length) {
    saveStatus.value = 'idle'
    lastSaveError.value = ''
    return { ok: true, savedCount: 0, failedCount: 0 }
  }

  saveStatus.value = 'saving'
  lastSaveError.value = ''

  const context = buildSaveContext({ profile, token })
  const creates = await saveEntries(
    createEntries,
    (entryKey, entry) => saveCreateEntry(context, entryKey, entry),
    'Could not create online item.',
  )
  const updates = await saveEntries(
    updateEntries,
    (entryKey, entry) => saveUpdateEntry(context, entryKey, entry),
    'Could not save online changes.',
  )

  return finishSave({
    savedCount: creates.savedCount + updates.savedCount,
    failed: [...creates.failed, ...updates.failed],
    createdItems: creates.savedItems,
  })
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
