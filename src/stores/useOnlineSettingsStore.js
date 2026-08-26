import { ref } from 'vue'
import { fetchViewerSettingsFromStrapi, updateViewerSettingsInStrapi } from '../services/strapiApi'
import { useAuthStore } from './useAuthStore'
import { useConnectionProfileStore } from './useConnectionProfileStore'

const settings = ref(null)
const wording = ref({})
const settingsStatus = ref('idle')
const lastSettingsError = ref('')

function clearOnlineSettings() {
  settings.value = null
  wording.value = {}
  settingsStatus.value = 'idle'
  lastSettingsError.value = ''
}

function markOnlineSettingsInvalid(message) {
  settingsStatus.value = 'error'
  lastSettingsError.value = String(message || 'Online settings payload is invalid.')
}

async function fetchOnlineSettings() {
  const { connectionProfile } = useConnectionProfileStore()
  const { token } = useAuthStore()

  if (!connectionProfile.value) {
    settingsStatus.value = 'error'
    lastSettingsError.value = 'No saved connection profile found.'
    return { ok: false, error: lastSettingsError.value }
  }

  settingsStatus.value = 'loading'
  lastSettingsError.value = ''

  try {
    const result = await fetchViewerSettingsFromStrapi({
      profile: connectionProfile.value,
      token: token.value || '',
    })
    settings.value = result.settings
    wording.value = result.wording
    settingsStatus.value = 'ready'
    return { ok: true, settings: result.settings, wording: result.wording, payload: result.payload }
  } catch (error) {
    settings.value = null
    wording.value = {}
    settingsStatus.value = 'error'
    lastSettingsError.value =
      typeof error?.message === 'string' && error.message.trim()
        ? error.message.trim()
        : 'Could not load online settings.'
    return { ok: false, error: lastSettingsError.value }
  }
}

async function persistOnlineSettings(nextSettings) {
  const { connectionProfile } = useConnectionProfileStore()
  const { token } = useAuthStore()

  if (!connectionProfile.value) {
    settingsStatus.value = 'error'
    lastSettingsError.value = 'No saved connection profile found.'
    return { ok: false, error: lastSettingsError.value }
  }

  settingsStatus.value = 'loading'
  lastSettingsError.value = ''

  try {
    const result = await updateViewerSettingsInStrapi({
      profile: connectionProfile.value,
      token: token.value || '',
      settings: nextSettings,
    })
    settings.value = result.settings
    if (result.wording && typeof result.wording === 'object') {
      wording.value = result.wording
    }
    settingsStatus.value = 'ready'
    return { ok: true, settings: result.settings, wording: wording.value, payload: result.payload }
  } catch (error) {
    settingsStatus.value = 'error'
    lastSettingsError.value =
      typeof error?.message === 'string' && error.message.trim()
        ? error.message.trim()
        : 'Could not save online settings.'
    return { ok: false, error: lastSettingsError.value }
  }
}

export function useOnlineSettingsStore() {
  return {
    settings,
    wording,
    settingsStatus,
    lastSettingsError,
    clearOnlineSettings,
    markOnlineSettingsInvalid,
    fetchOnlineSettings,
    persistOnlineSettings,
  }
}
