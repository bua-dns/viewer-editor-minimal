import { ref } from 'vue'
import appConfig from '../../config/app.config'

const APP_MODE_STORAGE_KEY = 'viewerEditor.appMode.v1'
const ONLINE_CONFIG_ONLY_STORAGE_KEY = 'viewerEditor.onlineConfigOnly.v1'
const APP_MODES = new Set(['offline', 'online'])

function normalizeConnectionMode(value) {
  if (value === 'offline' || value === 'online' || value === 'switchable') {
    return value
  }
  return 'switchable'
}

const connectionMode = normalizeConnectionMode(appConfig.connectionMode)
const fixedAppMode = connectionMode === 'switchable' ? '' : connectionMode

const appMode = ref(fixedAppMode || 'offline')
const onlineConfigOnly = ref(false)

function getLocalStorageSafe() {
  try {
    return globalThis.localStorage
  } catch {
    return null
  }
}

function loadAppModeFromStorage() {
  if (fixedAppMode) {
    appMode.value = fixedAppMode
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
  if (fixedAppMode) {
    appMode.value = fixedAppMode
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
    isConnectionModeSwitchable: connectionMode === 'switchable',
    loadAppModeFromStorage,
    loadOnlineConfigOnlyFromStorage,
    setAppMode,
    setOnlineConfigOnly,
  }
}
