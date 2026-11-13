import { computed, ref } from 'vue'
import {
  createCollectionItemInStrapi,
  fetchAllCollectionItemsFromStrapi,
  fetchCollectionItemFromStrapi,
  findCollectionItemByFieldValue,
  getWikidataAutosuggestFieldKeysFromSettings,
  normalizeOnlineChangedFieldsForStrapi,
  normalizeStrapiItem,
  pickNonEmptyOnlineFields,
  resolveCreateKeyFieldFromSettings,
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

// The pending maps change in place: a replacements run tracks thousands of items, and copying
// the whole map per item made that run quadratic (minutes of a blocked tab for ~10 000 items).
function setPendingCreate(entryKey, entry) {
  pendingCreatesById.value[entryKey] = entry
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
  pendingUpdatesById.value[entryKey] = entry
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
  delete pendingUpdatesById.value[entryKey]
}

function removePendingCreate(entryKey) {
  delete pendingCreatesById.value[entryKey]
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

function describeCollectionForSave(collectionSettings) {
  const fieldConfigs = collectionSettings.fields && typeof collectionSettings.fields === 'object'
    ? collectionSettings.fields
    : {}
  return {
    fieldConfigs,
    scanFieldKey: resolveScanFieldFromSettings(collectionSettings),
    wikidataFieldKeys: getWikidataAutosuggestFieldKeysFromSettings(collectionSettings),
    createKeyField: resolveCreateKeyFieldFromSettings(collectionSettings),
  }
}

// Every entry is saved with the configuration of its own collection (primary or secondary).
function buildSaveContext({ profile, token }) {
  const { settingsForItemsPath } = useOnlineSettingsStore()
  const collectionsByPath = new Map()
  return {
    profile,
    token,
    collectionOf(entry) {
      if (!collectionsByPath.has(entry.itemsPath)) {
        collectionsByPath.set(entry.itemsPath, describeCollectionForSave(settingsForItemsPath(entry.itemsPath)))
      }
      return collectionsByPath.get(entry.itemsPath)
    },
  }
}

async function loadServerItem(context, entry, fieldKeys) {
  const collection = context.collectionOf(entry)
  const row = await fetchCollectionItemFromStrapi({
    profile: context.profile,
    itemsPath: entry.itemsPath,
    token: context.token,
    id: entry.id,
    populateFields: fieldKeys.filter((key) => collection.wikidataFieldKeys.includes(key)),
  })
  const knownFields = { ...Object.fromEntries(fieldKeys.map((key) => [key, {}])), ...collection.fieldConfigs }
  return normalizeStrapiItem(row, knownFields, entry.itemsPath, collection.scanFieldKey)
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
    changedFields: normalizeOnlineChangedFieldsForStrapi(sentFields, context.collectionOf(entry).fieldConfigs),
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

function generateCreateKey() {
  if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID()
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`
}

function describeUnknownCreateOutcome(error, canCheckForDuplicate) {
  const advice = canCheckForDuplicate
    ? 'Saving again first checks whether it exists.'
    : 'Check the collection before saving again, otherwise it may be created twice.'
  return new Error(`${error.message} The new item may have been stored anyway. ${advice}`, { cause: error })
}

/**
 * With a `createKeyField`, every create carries a generated key. After a create whose answer was
 * lost (timeout, network), the next save looks the key up instead of creating the item again.
 */
async function findEarlierCreate(context, entry) {
  const { createKeyField } = context.collectionOf(entry)
  if (!createKeyField || !entry.createOutcomeUnknown) return null
  return findCollectionItemByFieldValue({
    profile: context.profile,
    itemsPath: entry.itemsPath,
    token: context.token,
    fieldKey: createKeyField,
    value: entry.createKey,
  })
}

async function postCreate(context, entry, sentFields) {
  const { fieldConfigs, createKeyField } = context.collectionOf(entry)
  const fields = pickNonEmptyOnlineFields(normalizeOnlineChangedFieldsForStrapi(sentFields, fieldConfigs))
  if (createKeyField) {
    entry.createKey = entry.createKey || generateCreateKey()
    fields[createKeyField] = entry.createKey
  }
  entry.lastSentFields = sentFields

  try {
    const payload = await createCollectionItemInStrapi({
      profile: context.profile,
      itemsPath: entry.itemsPath,
      token: context.token,
      fields,
    })
    return payload?.data && typeof payload.data === 'object' ? payload.data : null
  } catch (error) {
    if (!error?.outcomeUnknown) throw error
    entry.createOutcomeUnknown = true
    throw describeUnknownCreateOutcome(error, Boolean(createKeyField))
  }
}

async function saveCreateEntry(context, entryKey, entry) {
  const earlierRow = await findEarlierCreate(context, entry)
  // Found: the lost request stored what it sent, so that is what later edits are compared with.
  const sentFields = earlierRow ? entry.lastSentFields : cloneValue(entry.changedFields)
  const createdRow = earlierRow || (await postCreate(context, entry, sentFields))
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

// The pending entry of one item: an update is keyed by its id, a new item by its draft id.
function resolveItemEntryKey(item) {
  const onlineMeta = item?.[ONLINE_META_KEY]
  if (!onlineMeta || typeof onlineMeta !== 'object') return ''
  const id = onlineMeta.isDraft === true ? onlineMeta.draftId : onlineMeta.id
  if (!id || !onlineMeta.itemsPath) return ''
  return createEntryKey(onlineMeta.itemsPath, id)
}

function pickEntry(entriesById, entryKey) {
  const entry = entryKey ? entriesById[entryKey] : null
  return entry ? [[entryKey, entry]] : []
}

/** The edited item object of a pending update, so reloading linked items keeps unsaved edits. */
function findPendingUpdateItem(itemsPath, id) {
  return pendingUpdatesById.value[createEntryKey(itemsPath, id)]?.item || null
}

/** Drops the unsaved changes of one item (it was deleted or is no longer shown). */
function discardPendingChangesForItem(item) {
  const entryKey = resolveItemEntryKey(item)
  if (!entryKey) return
  removePendingUpdate(entryKey)
  removePendingCreate(entryKey)
}

function hasPendingChangesForItem(item) {
  const entryKey = resolveItemEntryKey(item)
  if (!entryKey) return false
  return Boolean(pendingUpdatesById.value[entryKey] || pendingCreatesById.value[entryKey])
}

async function saveOnlineUpdates({ profile, token = '' }) {
  return saveEntryLists({
    profile,
    token,
    createEntries: Object.entries(pendingCreatesById.value),
    updateEntries: Object.entries(pendingUpdatesById.value),
  })
}

// "Save item": writes only the pending create or update of this one item.
async function saveOnlineItem({ profile, token = '', item }) {
  const entryKey = resolveItemEntryKey(item)
  return saveEntryLists({
    profile,
    token,
    createEntries: pickEntry(pendingCreatesById.value, entryKey),
    updateEntries: pickEntry(pendingUpdatesById.value, entryKey),
  })
}

async function saveEntryLists({ profile, token, createEntries, updateEntries }) {
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
    saveOnlineItem,
    hasPendingChangesForItem,
    findPendingUpdateItem,
    discardPendingChangesForItem,
  }
}
