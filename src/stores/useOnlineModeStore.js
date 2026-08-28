import { computed, ref, watch } from 'vue'
import { useAppConfigStore } from './useAppConfigStore'

const APP_MODE_STORAGE_KEY = 'viewerEditor.appMode.v1'
const ONLINE_CONFIG_ONLY_STORAGE_KEY = 'viewerEditor.onlineConfigOnly.v1'
const APP_MODES = new Set(['offline', 'online'])

function normalizeConnectionMode(value) {
  if (value === 'offline' || value === 'online' || value === 'switchable') {
    return value
  }
  return 'switchable'
}

const { connectionMode: appConnectionMode } = useAppConfigStore()
const connectionMode = computed(() => normalizeConnectionMode(appConnectionMode.value))
const fixedAppMode = computed(() => (connectionMode.value === 'switchable' ? '' : connectionMode.value))

const appMode = ref(fixedAppMode.value || 'offline')
const onlineConfigOnly = ref(false)

function getLocalStorageSafe() {
  try {
    return globalThis.localStorage
  } catch {
    return null
  }
}

function loadAppModeFromStorage() {
  if (fixedAppMode.value) {
    appMode.value = fixedAppMode.value
    return
  }

  const storage = getLocalStorageSafe()
  if (!storage) return

  const stored = storage.getItem(APP_MODE_STORAGE_KEY)
  if (APP_MODES.has(stored)) {
    appMode.value = stored
  }
}

function loadOnlineConfigOnlyFromStorage() {
  const storage = getLocalStorageSafe()
  if (!storage) return

  const stored = storage.getItem(ONLINE_CONFIG_ONLY_STORAGE_KEY)
  onlineConfigOnly.value = stored === 'true'
}

function setAppMode(nextMode) {
  if (!APP_MODES.has(nextMode)) return false
  if (fixedAppMode.value) {
    appMode.value = fixedAppMode.value
    return false
  }
  if (appMode.value === nextMode) return false

  appMode.value = nextMode
  const storage = getLocalStorageSafe()
  if (storage) {
    storage.setItem(APP_MODE_STORAGE_KEY, nextMode)
  }
  return true
}

watch(
  () => fixedAppMode.value,
  (nextFixedMode) => {
    if (nextFixedMode) {
      appMode.value = nextFixedMode
      return
    }

    if (!APP_MODES.has(appMode.value)) {
      appMode.value = 'offline'
    }
  },
)

function setOnlineConfigOnly(nextValue) {
  const normalized = Boolean(nextValue)
  if (onlineConfigOnly.value === normalized) return false

  onlineConfigOnly.value = normalized
  const storage = getLocalStorageSafe()
  if (storage) {
    storage.setItem(ONLINE_CONFIG_ONLY_STORAGE_KEY, String(normalized))
  }
  return true
}

export function useOnlineModeStore() {
  return {
    appMode,
    onlineConfigOnly,
    connectionMode,
    isConnectionModeSwitchable: computed(() => connectionMode.value === 'switchable'),
    loadAppModeFromStorage,
    loadOnlineConfigOnlyFromStorage,
    setAppMode,
    setOnlineConfigOnly,
  }
}
