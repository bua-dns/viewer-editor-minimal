import { computed, ref, watch } from 'vue'
import { useAppConfigStore } from './useAppConfigStore'
import { useConnectionProfileStore } from './useConnectionProfileStore'

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
const { hasConnectionProfile } = useConnectionProfileStore()
const connectionMode = computed(() => normalizeConnectionMode(appConnectionMode.value))
const fixedAppMode = computed(() => (connectionMode.value === 'switchable' ? '' : connectionMode.value))

const appMode = ref(fixedAppMode.value || 'offline')
const onlineConfigOnly = ref(false)
// Set when the user chose `online` without a connection profile. Once a profile is saved,
// the mode switches to online by itself.
const isOnlineSwitchPending = ref(false)

function getLocalStorageSafe() {
  try {
    return globalThis.localStorage
  } catch {
    return null
  }
}

function writeAppModeToStorage(nextMode) {
  const storage = getLocalStorageSafe()
  if (storage) {
    storage.setItem(APP_MODE_STORAGE_KEY, nextMode)
  }
}

// Reads the connection profile state, so it must run after the profile is initialized.
function loadAppModeFromStorage() {
  if (fixedAppMode.value) {
    appMode.value = fixedAppMode.value
    return
  }

  const storage = getLocalStorageSafe()
  if (!storage) return

  const stored = storage.getItem(APP_MODE_STORAGE_KEY)
  if (stored === 'online' && !hasConnectionProfile.value) {
    appMode.value = 'offline'
    return
  }
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

// Returns true when the mode changed. Choosing `online` without a connection profile keeps
// the mode and marks the switch as pending; the caller then opens the Einstellungen tab.
function setAppMode(nextMode) {
  if (!APP_MODES.has(nextMode)) return false
  if (fixedAppMode.value) {
    appMode.value = fixedAppMode.value
    return false
  }

  if (nextMode === 'online' && !hasConnectionProfile.value) {
    isOnlineSwitchPending.value = true
    return false
  }

  isOnlineSwitchPending.value = false
  if (appMode.value === nextMode) return false

  appMode.value = nextMode
  writeAppModeToStorage(nextMode)
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

watch(
  () => hasConnectionProfile.value,
  (nextHasProfile) => {
    if (fixedAppMode.value) return
    if (nextHasProfile && isOnlineSwitchPending.value) {
      setAppMode('online')
      return
    }
    if (!nextHasProfile && appMode.value === 'online') {
      appMode.value = 'offline'
      writeAppModeToStorage('offline')
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
    isOnlineSwitchPending,
    loadAppModeFromStorage,
    loadOnlineConfigOnlyFromStorage,
    setAppMode,
    setOnlineConfigOnly,
  }
}
