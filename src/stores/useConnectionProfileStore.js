import { computed, ref } from 'vue'
import {
  createSavedConnectionProfile,
  joinBaseUrlAndPath,
  parseConnectionProfileJsonText,
  validateConnectionProfile,
} from '../composables/connectionProfile'
import { checkDataModelImplementationInStrapi } from '../services/strapiApi'

const CONNECTION_PROFILE_STORAGE_KEY = 'viewerEditor.connectionProfile.v1'

const connectionProfile = ref(null)
const lastConnectionProfileLoadError = ref(null)

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
    lastConnectionProfileLoadError.value = {
      source: 'storage',
      reason: 'storage-unavailable',
      error: 'Local storage is not available.',
    }
    return { ok: false, reason: 'storage-unavailable' }
  }

  const storedValue = storage.getItem(CONNECTION_PROFILE_STORAGE_KEY)
  if (!storedValue) {
    connectionProfile.value = null
    lastConnectionProfileLoadError.value = null
    return { ok: true, hasProfile: false }
  }

  const parsed = parseConnectionProfileJsonText(storedValue)
  if (!parsed.ok) {
    connectionProfile.value = null
    lastConnectionProfileLoadError.value = {
      source: 'storage',
      reason: 'invalid-json',
      error: parsed.error,
    }
    return { ok: false, reason: 'invalid-json', error: parsed.error }
  }

  const validation = validateConnectionProfile(parsed.value)
  if (!validation.ok) {
    connectionProfile.value = null
    lastConnectionProfileLoadError.value = {
      source: 'storage',
      reason: 'invalid-profile',
      errors: validation.errors,
    }
    return { ok: false, reason: 'invalid-profile', errors: validation.errors }
  }

  connectionProfile.value = validation.profile
  lastConnectionProfileLoadError.value = null
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
  lastConnectionProfileLoadError.value = null
  return { ok: true, profile: validation.profile }
}

function clearConnectionProfile() {
  const storage = getLocalStorageSafe()
  if (storage) {
    storage.removeItem(CONNECTION_PROFILE_STORAGE_KEY)
  }
  connectionProfile.value = null
  lastConnectionProfileLoadError.value = null
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

function uniqueNonEmpty(values) {
  return Array.from(new Set(values.filter(Boolean)))
}

function normalizePathPrefix(value) {
  const normalized = String(value || '').trim()
  if (!normalized) return '/'

  const withLeadingSlash = normalized.startsWith('/') ? normalized : `/${normalized}`
  return withLeadingSlash.endsWith('/') ? withLeadingSlash : `${withLeadingSlash}/`
}

function collectLocationPathPrefixes() {
  const pathname = String(globalThis?.location?.pathname || '').trim()
  if (!pathname) return []

  const sanitizedPathname = pathname.split('?')[0].split('#')[0]
  const segments = sanitizedPathname.split('/').filter(Boolean)
  const pointsToDirectory = sanitizedPathname.endsWith('/')
  const directorySegments = pointsToDirectory ? segments : segments.slice(0, -1)

  const prefixes = []
  for (let index = directorySegments.length; index >= 0; index -= 1) {
    const partialSegments = directorySegments.slice(0, index)
    const prefix = partialSegments.length ? `/${partialSegments.join('/')}/` : '/'
    prefixes.push(prefix)
  }

  return uniqueNonEmpty(prefixes)
}

function resolveRuntimePathPrefixes() {
  const rawBasePath = String(import.meta?.env?.BASE_URL || '/').trim()
  const basePath = normalizePathPrefix(rawBasePath)
  const locationPrefixes = collectLocationPathPrefixes()
  return uniqueNonEmpty([...locationPrefixes, basePath, '/'])
}

function resolveDefaultConnectionProfileUrls(value) {
  const normalized = String(value || '').trim()
  if (!normalized) return []

  if (/^https?:\/\//i.test(normalized)) return [normalized]

  const prefixes = resolveRuntimePathPrefixes()
  const cleanedPath = normalized.replace(/^\/+/, '')

  if (normalized.startsWith('/') || normalized.includes('/')) {
    return uniqueNonEmpty(prefixes.map((prefix) => `${prefix}${cleanedPath}`))
  }

  const withConnectionProfile = prefixes.map((prefix) => `${prefix}connection-profile/${cleanedPath}`)
  const direct = prefixes.map((prefix) => `${prefix}${cleanedPath}`)
  return uniqueNonEmpty([...withConnectionProfile, ...direct])
}

async function loadConnectionProfileFromDefault(defaultProfilePath = '') {
  const profileUrls = resolveDefaultConnectionProfileUrls(defaultProfilePath)
  if (!profileUrls.length) {
    return loadConnectionProfileFromStorage()
  }

  if (typeof globalThis.fetch !== 'function') {
    connectionProfile.value = null
    lastConnectionProfileLoadError.value = {
      source: 'default',
      reason: 'fetch-unavailable',
      error: 'Fetch API is not available in this environment.',
    }
    return { ok: false, reason: 'fetch-unavailable', error: 'Fetch API is not available in this environment.' }
  }

  let payloadText = ''
  let loadedProfileUrl = ''
  let lastFetchError = null
  for (const candidateUrl of profileUrls) {
    try {
      const response = await fetch(candidateUrl, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
      })
      if (!response.ok) {
        lastFetchError = `Could not load default connection profile (HTTP ${response.status}).`
        continue
      }
      payloadText = await response.text()
      loadedProfileUrl = candidateUrl
      break
    } catch {
      lastFetchError = 'Could not load default connection profile.'
    }
  }

  if (!loadedProfileUrl) {
    connectionProfile.value = null
    lastConnectionProfileLoadError.value = {
      source: 'default',
      reason: 'fetch-failed',
      error: lastFetchError || 'Could not load default connection profile.',
      profileUrl: profileUrls[0] || '',
      attemptedUrls: profileUrls,
    }
    return {
      ok: false,
      reason: 'fetch-failed',
      error: lastFetchError || 'Could not load default connection profile.',
      profileUrl: profileUrls[0] || '',
    }
  }

  const parsed = parseConnectionProfileJsonText(payloadText)
  if (!parsed.ok) {
    connectionProfile.value = null
    lastConnectionProfileLoadError.value = {
      source: 'default',
      reason: 'invalid-json',
      error: parsed.error,
      profileUrl: loadedProfileUrl,
    }
    return {
      ok: false,
      reason: 'invalid-json',
      error: parsed.error,
      profileUrl: loadedProfileUrl,
    }
  }

  const validation = validateConnectionProfile(parsed.value)
  if (!validation.ok) {
    connectionProfile.value = null
    lastConnectionProfileLoadError.value = {
      source: 'default',
      reason: 'invalid-profile',
      errors: validation.errors,
      profileUrl: loadedProfileUrl,
    }
    return {
      ok: false,
      reason: 'invalid-profile',
      errors: validation.errors,
      profileUrl: loadedProfileUrl,
    }
  }

  connectionProfile.value = validation.profile
  lastConnectionProfileLoadError.value = null

  const storage = getLocalStorageSafe()
  if (storage) {
    storage.setItem(CONNECTION_PROFILE_STORAGE_KEY, JSON.stringify(validation.profile))
  }

  return { ok: true, hasProfile: true, profile: validation.profile, source: 'default', profileUrl: loadedProfileUrl }
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
    lastConnectionProfileLoadError,
    hasConnectionProfile,
    loadConnectionProfileFromStorage,
    loadConnectionProfileFromDefault,
    saveConnectionProfile,
    clearConnectionProfile,
    importConnectionProfileFromJsonText,
    exportConnectionProfileAsJson,
    buildDraftProfile,
    testConnection,
    checkDataModelImplementation,
  }
}
