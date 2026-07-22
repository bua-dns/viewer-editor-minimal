import { computed, ref } from 'vue'
import {
  createSavedConnectionProfile,
  joinBaseUrlAndPath,
  parseConnectionProfileJsonText,
  validateConnectionProfile,
} from '../composables/connectionProfile'

const CONNECTION_PROFILE_STORAGE_KEY = 'viewerEditor.connectionProfile.v1'

const connectionProfile = ref(null)

function getLocalStorageSafe() {
  try {
    return globalThis.localStorage
  } catch {
    return null
  }
}

function loadConnectionProfileFromStorage() {
  const storage = getLocalStorageSafe()
  if (!storage) return { ok: false, reason: 'storage-unavailable' }

  const storedValue = storage.getItem(CONNECTION_PROFILE_STORAGE_KEY)
  if (!storedValue) {
    connectionProfile.value = null
    return { ok: true, hasProfile: false }
  }

  const parsed = parseConnectionProfileJsonText(storedValue)
  if (!parsed.ok) {
    connectionProfile.value = null
    return { ok: false, reason: 'invalid-json', error: parsed.error }
  }

  const validation = validateConnectionProfile(parsed.value)
  if (!validation.ok) {
    connectionProfile.value = null
    return { ok: false, reason: 'invalid-profile', errors: validation.errors }
  }

  connectionProfile.value = validation.profile
  return { ok: true, hasProfile: true, profile: validation.profile }
}

function saveConnectionProfile(input = {}) {
  const storage = getLocalStorageSafe()
  if (!storage) {
    return { ok: false, error: 'Local storage is not available.' }
  }

  const profileToSave = createSavedConnectionProfile(input)
  const validation = validateConnectionProfile(profileToSave)
  if (!validation.ok) {
    return { ok: false, error: 'Validation failed.', errors: validation.errors }
  }

  storage.setItem(CONNECTION_PROFILE_STORAGE_KEY, JSON.stringify(validation.profile))
  connectionProfile.value = validation.profile
  return { ok: true, profile: validation.profile }
}

function clearConnectionProfile() {
  const storage = getLocalStorageSafe()
  if (storage) {
    storage.removeItem(CONNECTION_PROFILE_STORAGE_KEY)
  }
  connectionProfile.value = null
}

function importConnectionProfileFromJsonText(jsonText) {
  const parsed = parseConnectionProfileJsonText(jsonText)
  if (!parsed.ok) {
    return { ok: false, error: parsed.error }
  }

  return saveConnectionProfile(parsed.value)
}

function exportConnectionProfileAsJson() {
  if (!connectionProfile.value) return ''
  return JSON.stringify(connectionProfile.value, null, 2)
}

function buildDraftProfile() {
  if (!connectionProfile.value) {
    return {
      version: 1,
      label: '',
      baseUrl: '',
      configPath: '',
      updatedAt: '',
    }
  }

  return {
    version: 1,
    label: connectionProfile.value.label || '',
    baseUrl: connectionProfile.value.baseUrl || '',
    configPath: connectionProfile.value.configPath || '',
    updatedAt: connectionProfile.value.updatedAt || '',
  }
}

async function testConnection(input = {}) {
  const profile = Object.keys(input || {}).length ? createSavedConnectionProfile(input) : connectionProfile.value
  if (!profile) {
    return { ok: false, error: 'No connection profile available.', errors: { profile: 'missing' } }
  }

  const validation = validateConnectionProfile(profile)
  if (!validation.ok) {
    return { ok: false, error: 'Validation failed.', errors: validation.errors }
  }

  if (typeof globalThis.fetch !== 'function') {
    return { ok: false, error: 'Fetch API is not available in this environment.' }
  }

  const configUrl = joinBaseUrlAndPath(validation.profile.baseUrl, validation.profile.configPath)
  const authUrl = joinBaseUrlAndPath(validation.profile.baseUrl, '/api/auth/local')

  let configStatus = null
  let authStatus = null

  try {
    const configResponse = await fetch(configUrl, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    })
    configStatus = configResponse.status
  } catch {
    return { ok: false, error: 'Could not reach config endpoint.', configUrl, authUrl }
  }

  try {
    const authResponse = await fetch(authUrl, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ identifier: '__probe__', password: '__probe__' }),
    })
    authStatus = authResponse.status
  } catch {
    return {
      ok: false,
      error: 'Config endpoint is reachable, but auth endpoint probe failed.',
      configUrl,
      authUrl,
      details: {
        configStatus,
      },
    }
  }

  const hasConfigEndpoint = configStatus !== 404
  const hasAuthEndpoint = authStatus !== 404

  if (!hasConfigEndpoint || !hasAuthEndpoint) {
    return {
      ok: false,
      error: 'Connection test failed. One or more endpoints returned 404.',
      configUrl,
      authUrl,
      details: {
        configStatus,
        authStatus,
      },
    }
  }

  return {
    ok: true,
    configUrl,
    authUrl,
    details: {
      configStatus,
      authStatus,
    },
  }
}

const hasConnectionProfile = computed(() => Boolean(connectionProfile.value))

export function useConnectionProfileStore() {
  return {
    connectionProfile,
    hasConnectionProfile,
    loadConnectionProfileFromStorage,
    saveConnectionProfile,
    clearConnectionProfile,
    importConnectionProfileFromJsonText,
    exportConnectionProfileAsJson,
    buildDraftProfile,
    testConnection,
  }
}
