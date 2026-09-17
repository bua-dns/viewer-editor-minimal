import { computed, ref } from 'vue'
import {
  createSavedConnectionProfile,
  joinBaseUrlAndPath,
  parseConnectionProfileJsonText,
  validateConnectionProfile,
} from '../composables/connectionProfile'
import { checkDataModelImplementationInStrapi } from '../services/strapiApi'
import { useAppConfigStore } from './useAppConfigStore'

// A profile shipped in the basic config is fixed. Without one, the user enters a profile
// in the Einstellungen tab; it is kept in localStorage so a reload goes straight back online.
const CONNECTION_PROFILE_STORAGE_KEY = 'viewerEditor.connectionProfile.v1'

const { basicConnectionProfile } = useAppConfigStore()

const connectionProfile = ref(null)
const isProfileFixed = computed(() => Boolean(basicConnectionProfile.value))

function getLocalStorageSafe() {
  try {
    return globalThis.localStorage
  } catch {
    return null
  }
}

function loadConnectionProfileFromStorage() {
  const storage = getLocalStorageSafe()
  if (!storage) {
    connectionProfile.value = null
    return { ok: false, reason: 'storage-unavailable' }
  }

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

// Called once on start, after the basic config is loaded. The shipped profile wins; a
// stored one is then ignored, not deleted.
function initializeConnectionProfile() {
  if (isProfileFixed.value) {
    connectionProfile.value = basicConnectionProfile.value
    return { ok: true, hasProfile: true, source: 'basic-config', profile: connectionProfile.value }
  }
  return { ...loadConnectionProfileFromStorage(), source: 'storage' }
}

// Saves only a profile that passes the connection test, so online mode never starts
// against an address that does not answer.
async function saveConnectionProfile(input = {}) {
  if (isProfileFixed.value) {
    return { ok: false, reason: 'fixed', error: 'The connection profile is fixed by the basic config.' }
  }

  const storage = getLocalStorageSafe()
  if (!storage) {
    return { ok: false, error: 'Local storage is not available.' }
  }

  const profileToSave = createSavedConnectionProfile(input)
  const validation = validateConnectionProfile(profileToSave)
  if (!validation.ok) {
    return { ok: false, error: 'Validation failed.', errors: validation.errors }
  }

  const testResult = await testConnection(validation.profile)
  if (!testResult.ok) {
    return { ok: false, reason: 'connection-test-failed', error: testResult.error, test: testResult }
  }

  storage.setItem(CONNECTION_PROFILE_STORAGE_KEY, JSON.stringify(validation.profile))
  connectionProfile.value = validation.profile
  return { ok: true, profile: validation.profile }
}

function clearConnectionProfile() {
  if (isProfileFixed.value) return false
  const storage = getLocalStorageSafe()
  if (storage) {
    storage.removeItem(CONNECTION_PROFILE_STORAGE_KEY)
  }
  connectionProfile.value = null
  return true
}

async function importConnectionProfileFromJsonText(jsonText) {
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

async function checkDataModelImplementation(input = {}, options = {}) {
  const profile = Object.keys(input || {}).length ? createSavedConnectionProfile(input) : connectionProfile.value
  if (!profile) {
    return { ok: false, error: 'No connection profile available.', errors: { profile: 'missing' } }
  }

  const validation = validateConnectionProfile(profile)
  if (!validation.ok) {
    return { ok: false, error: 'Validation failed.', errors: validation.errors }
  }

  try {
    const result = await checkDataModelImplementationInStrapi({
      profile: validation.profile,
      token: String(options?.token || ''),
    })

    return {
      ok: result.ok,
      status: result.status,
      details: result,
    }
  } catch (error) {
    return {
      ok: false,
      status: 'error',
      error:
        typeof error?.message === 'string' && error.message.trim()
          ? error.message.trim()
          : 'Data model check failed.',
    }
  }
}

const hasConnectionProfile = computed(() => Boolean(connectionProfile.value))

export function useConnectionProfileStore() {
  return {
    connectionProfile,
    hasConnectionProfile,
    isProfileFixed,
    initializeConnectionProfile,
    loadConnectionProfileFromStorage,
    saveConnectionProfile,
    clearConnectionProfile,
    importConnectionProfileFromJsonText,
    exportConnectionProfileAsJson,
    buildDraftProfile,
    testConnection,
    checkDataModelImplementation,
  }
}
