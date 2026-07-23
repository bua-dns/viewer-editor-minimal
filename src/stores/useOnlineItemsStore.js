import { ref } from 'vue'
import {
  fetchAllCollectionItemsFromStrapi,
  normalizeStrapiItem,
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

    items.value = fetchedRows.map((rawRow) => normalizeStrapiItem(rawRow, settingsFieldKeys, itemsPath))
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
