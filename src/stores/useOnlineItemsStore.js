import { ref } from 'vue'
import {
  fetchAllCollectionItemsFromStrapi,
  resolveItemsPathFromSettings,
} from '../services/strapiApi'
import { useAuthStore } from './useAuthStore'
import { useConnectionProfileStore } from './useConnectionProfileStore'

const items = ref([])
const itemsStatus = ref('idle')
const lastItemsError = ref('')
const activeItemsPath = ref('')

function clearOnlineItems() {
  items.value = []
  itemsStatus.value = 'idle'
  lastItemsError.value = ''
  activeItemsPath.value = ''
}

function sanitizeOnlineItem(rawItem, settingsFieldKeys = []) {
  const source = rawItem && typeof rawItem === 'object' ? rawItem : {}
  const nextItem = {}

  settingsFieldKeys.forEach((fieldKey) => {
    if (Object.prototype.hasOwnProperty.call(source, fieldKey)) {
      nextItem[fieldKey] = source[fieldKey]
    }
  })

  if (Object.prototype.hasOwnProperty.call(source, 'scan')) {
    nextItem.scan = source.scan
  }

  return nextItem
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

  const settingsFieldKeys = Object.keys(settings?.fields || {})

  itemsStatus.value = 'loading'
  lastItemsError.value = ''
  activeItemsPath.value = itemsPath

  try {
    const fetchedRows = await fetchAllCollectionItemsFromStrapi({
      profile: connectionProfile.value,
      itemsPath,
      token: token.value || '',
    })

    items.value = fetchedRows.map((rawRow) => sanitizeOnlineItem(rawRow, settingsFieldKeys))
    itemsStatus.value = 'ready'
    return {
      ok: true,
      items: items.value,
      itemsPath,
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
    clearOnlineItems,
    fetchOnlineItems,
  }
}
