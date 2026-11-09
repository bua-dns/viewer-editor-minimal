import { computed, ref } from 'vue'
import { fetchCurrentUserFromStrapi, loginWithStrapi, setUnauthorizedHandler } from '../services/strapiApi'
import { useConnectionProfileStore } from './useConnectionProfileStore'

const AUTH_TOKEN_STORAGE_KEY = 'viewerEditor.authToken.v1'

const token = ref('')
const user = ref(null)
const authStatus = ref('anonymous')
const lastAuthError = ref('')
// The token was rejected (401) during a session. The session and its unsaved changes stay open
// until the user logs in again or logs out; `user` keeps the last user meanwhile.
const sessionExpired = ref(false)

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
  persistToken('')
  // An expired session keeps its user, so a failed re-login does not close the session.
  if (!sessionExpired.value) user.value = null
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
  sessionExpired.value = false
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
  sessionExpired.value = false
  clearAuthState()
  authStatus.value = 'anonymous'
  lastAuthError.value = ''
}

/**
 * Strapi rejected the token of the running session (usually: it expired). Only the token is
 * dropped; the session stays open so unsaved changes survive until the user logs in again.
 * 401s outside a running session (login, restoring a stored token) are handled where they occur.
 */
function handleUnauthorized() {
  if (authStatus.value !== 'authenticated') return
  sessionExpired.value = true
  clearAuthState()
  authStatus.value = 'expired'
  lastAuthError.value = 'Session expired. Log in again to save; unsaved changes are kept.'
}

setUnauthorizedHandler(handleUnauthorized)

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
// Open while logged in and while an expired session waits for a new login.
const hasOnlineSession = computed(() => isAuthenticated.value || sessionExpired.value)
// Changes when another user logs in; the loaded data and pending changes then belong to nobody.
const sessionUserId = computed(() => String(user.value?.id ?? user.value?.documentId ?? ''))

export function useAuthStore() {
  return {
    token,
    user,
    authStatus,
    lastAuthError,
    isAuthenticated,
    sessionExpired,
    hasOnlineSession,
    sessionUserId,
    login,
    logout,
    restoreSession,
    fetchCurrentUser,
    handleUnauthorized,
  }
}
