import { computed, ref } from 'vue'
import { updateCollectionItemInStrapi } from '../services/strapiApi'

const ONLINE_META_KEY = '__onlineMeta'

const pendingUpdatesById = ref({})
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
  saveStatus.value = 'idle'
  lastSaveError.value = ''
}

function trackOnlineFieldChange({ item, snapshotItem, key, nextValue }) {
  if (key === ONLINE_META_KEY) return false
  const onlineMeta = item?.[ONLINE_META_KEY]
  if (!onlineMeta || typeof onlineMeta !== 'object') return false

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

function removePendingUpdate(entryKey) {
  if (!Object.prototype.hasOwnProperty.call(pendingUpdatesById.value, entryKey)) return
  const nextEntries = { ...pendingUpdatesById.value }
  delete nextEntries[entryKey]
  pendingUpdatesById.value = nextEntries
}

async function saveOnlineUpdates({ profile, token = '' }) {
  const entries = Object.entries(pendingUpdatesById.value)
  if (!entries.length) {
    saveStatus.value = 'idle'
    lastSaveError.value = ''
    return { ok: true, savedCount: 0, failedCount: 0 }
  }

  saveStatus.value = 'saving'
  lastSaveError.value = ''

  const failed = []
  let savedCount = 0

  for (const [entryKey, entry] of entries) {
    try {
      await updateCollectionItemInStrapi({
        profile,
        itemsPath: entry.itemsPath,
        id: entry.id,
        token,
        changedFields: entry.changedFields,
      })
      removePendingUpdate(entryKey)
      savedCount += 1
    } catch (error) {
      failed.push({
        entryKey,
        id: entry.id,
        error:
          typeof error?.message === 'string' && error.message.trim()
            ? error.message.trim()
            : 'Could not save online changes.',
      })
    }
  }

  if (!failed.length) {
    saveStatus.value = 'success'
    lastSaveError.value = ''
    return { ok: true, savedCount, failedCount: 0 }
  }

  saveStatus.value = 'error'
  lastSaveError.value = `${failed.length} update(s) failed. ${failed[0].error}`
  return {
    ok: false,
    savedCount,
    failedCount: failed.length,
    failed,
    error: lastSaveError.value,
  }
}

const pendingUpdateCount = computed(() => Object.keys(pendingUpdatesById.value).length)
const hasPendingUpdates = computed(() => pendingUpdateCount.value > 0)

export function useOnlineUpdatesStore() {
  return {
    pendingUpdatesById,
    pendingUpdateCount,
    hasPendingUpdates,
    saveStatus,
    lastSaveError,
    clearOnlineUpdates,
    clearSaveFeedback,
    trackOnlineFieldChange,
    saveOnlineUpdates,
  }
}
