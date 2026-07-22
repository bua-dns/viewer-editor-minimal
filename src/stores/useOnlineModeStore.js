import { ref } from 'vue'

const APP_MODE_STORAGE_KEY = 'viewerEditor.appMode.v1'

const appMode = ref('offline')

function getLocalStorageSafe() {
  try {
    return globalThis.localStorage
  } catch {
    return null
  }
}

function loadAppModeFromStorage() {
  const storage = getLocalStorageSafe()
  if (!storage) return

  const stored = storage.getItem(APP_MODE_STORAGE_KEY)
  if (stored === 'offline' || stored === 'online') {
    appMode.value = stored
  }
}

function setAppMode(nextMode) {
  if (nextMode !== 'offline' && nextMode !== 'online') return false
  if (appMode.value === nextMode) return false

  appMode.value = nextMode
  const storage = getLocalStorageSafe()
  if (storage) {
    storage.setItem(APP_MODE_STORAGE_KEY, nextMode)
  }
  return true
}

export function useOnlineModeStore() {
  return {
    appMode,
    loadAppModeFromStorage,
    setAppMode,
  }
}
