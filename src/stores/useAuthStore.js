import { computed, ref } from 'vue'
import { fetchCurrentUserFromStrapi, loginWithStrapi } from '../services/strapiApi'
import { useConnectionProfileStore } from './useConnectionProfileStore'

const AUTH_TOKEN_STORAGE_KEY = 'viewerEditor.authToken.v1'

const token = ref('')
const user = ref(null)
const authStatus = ref('anonymous')
const lastAuthError = ref('')

function getLocalStorageSafe() {
  try {
    return globalThis.localStorage
  } catch {
    return null
  }
}

function persistToken(nextToken) {
  const storage = getLocalStorageSafe()
  if (!storage) return

  if (nextToken) {
    storage.setItem(AUTH_TOKEN_STORAGE_KEY, nextToken)
  } else {
    storage.removeItem(AUTH_TOKEN_STORAGE_KEY)
  }
}

function clearAuthState() {
  token.value = ''
  user.value = null
  persistToken('')
}

function normalizeAuthErrorMessage(error, fallback) {
  if (error?.status === 401) return 'Authentication failed. Please check credentials.'
  if (typeof error?.message === 'string' && error.message.trim()) return error.message.trim()
  return fallback
}

async function fetchCurrentUser() {
  const { connectionProfile } = useConnectionProfileStore()
  if (!connectionProfile.value || !token.value) {
    throw new Error('Cannot fetch user without token and connection profile.')
  }

  const currentUser = await fetchCurrentUserFromStrapi({
    profile: connectionProfile.value,
    token: token.value,
  })

  user.value = currentUser
  authStatus.value = 'authenticated'
  lastAuthError.value = ''
  return currentUser
}

async function login(identifier, password) {
  const normalizedIdentifier = String(identifier || '').trim()
  const normalizedPassword = String(password || '')
  const { connectionProfile } = useConnectionProfileStore()

  if (!connectionProfile.value) {
    authStatus.value = 'error'
    lastAuthError.value = 'No saved connection profile found.'
    return { ok: false, error: lastAuthError.value }
  }

  if (!normalizedIdentifier || !normalizedPassword) {
    authStatus.value = 'error'
    lastAuthError.value = 'Identifier and password are required.'
    return { ok: false, error: lastAuthError.value }
  }

  authStatus.value = 'authenticating'
  lastAuthError.value = ''

  try {
    const authResult = await loginWithStrapi({
      profile: connectionProfile.value,
      identifier: normalizedIdentifier,
      password: normalizedPassword,
    })

    token.value = authResult.jwt
    persistToken(authResult.jwt)
    await fetchCurrentUser()
    return { ok: true, user: user.value }
  } catch (error) {
    clearAuthState()
    authStatus.value = 'error'
    lastAuthError.value = normalizeAuthErrorMessage(error, 'Login failed.')
    return { ok: false, error: lastAuthError.value }
  }
}

function logout() {
  clearAuthState()
  authStatus.value = 'anonymous'
  lastAuthError.value = ''
}

function handleUnauthorized() {
  clearAuthState()
  authStatus.value = 'anonymous'
  lastAuthError.value = 'Session expired. Please log in again.'
}

async function restoreSession() {
  const { connectionProfile } = useConnectionProfileStore()
  const storage = getLocalStorageSafe()
  const storedToken = storage?.getItem(AUTH_TOKEN_STORAGE_KEY) || ''

  if (!storedToken) {
    clearAuthState()
    authStatus.value = 'anonymous'
    return { ok: true, restored: false }
  }

  if (!connectionProfile.value) {
    clearAuthState()
    authStatus.value = 'anonymous'
    lastAuthError.value = 'Session could not be restored because no connection profile is configured.'
    return { ok: false, restored: false, error: lastAuthError.value }
  }

  token.value = storedToken
  authStatus.value = 'restoring'
  lastAuthError.value = ''

  try {
    await fetchCurrentUser()
    return { ok: true, restored: true, user: user.value }
  } catch (error) {
    clearAuthState()
    authStatus.value = 'anonymous'
    lastAuthError.value = normalizeAuthErrorMessage(error, 'Session could not be restored.')
    return { ok: false, restored: false, error: lastAuthError.value }
  }
}

const isAuthenticated = computed(() => authStatus.value === 'authenticated' && Boolean(token.value))

export function useAuthStore() {
  return {
    token,
    user,
    authStatus,
    lastAuthError,
    isAuthenticated,
    login,
    logout,
    restoreSession,
    fetchCurrentUser,
    handleUnauthorized,
  }
}
