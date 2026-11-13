import { beforeEach, describe, expect, test, vi } from 'vitest'
import { useAuthStore } from './useAuthStore'
import { useConnectionProfileStore } from './useConnectionProfileStore'
import { strapiFetchJson } from '../services/strapiApi'
import { createLocalStorageMock } from '../../test/helpers/storageMock.js'

describe('useAuthStore', () => {
  beforeEach(() => {
    globalThis.localStorage = createLocalStorageMock()
    const authStore = useAuthStore()
    const connectionStore = useConnectionProfileStore()
    authStore.logout()
    connectionStore.clearConnectionProfile()
    connectionStore.connectionProfile.value = {
      version: 1,
      label: 'Test',
      baseUrl: 'https://cms.example.org/project',
      configPath: '/api/viewer-setting',
    }
  })

  test('logs in and stores JWT', async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ jwt: 'token-1', user: { id: 1 } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 1, username: 'editor' }),
      })

    const authStore = useAuthStore()
    const result = await authStore.login('editor@example.org', 'secret')

    expect(result.ok).toBe(true)
    expect(authStore.isAuthenticated.value).toBe(true)
    expect(authStore.user.value.username).toBe('editor')
  })

  test('restoreSession loads JWT from storage and fetches user', async () => {
    globalThis.localStorage.setItem('viewerEditor.authToken.v1', 'token-restored')
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 2, username: 'restored' }),
    })

    const authStore = useAuthStore()
    const result = await authStore.restoreSession()

    expect(result.ok).toBe(true)
    expect(result.restored).toBe(true)
    expect(authStore.user.value.username).toBe('restored')
    expect(authStore.isAuthenticated.value).toBe(true)
  })

  test('login fails without credentials', async () => {
    const authStore = useAuthStore()
    const result = await authStore.login('', '')

    expect(result.ok).toBe(false)
    expect(authStore.authStatus.value).toBe('error')
  })
})

describe('useAuthStore expired session (review F2, F10)', () => {
  const PROFILE = {
    version: 1,
    label: 'Test',
    baseUrl: 'https://cms.example.org/project',
    configPath: '/api/viewer-setting',
  }

  function okResponse(body) {
    return { ok: true, status: 200, json: async () => body }
  }

  function unauthorizedResponse() {
    return { ok: false, status: 401, json: async () => ({ error: { message: 'Invalid credentials' } }) }
  }

  async function loginAs(authStore, userId) {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce(okResponse({ jwt: `token-${userId}`, user: { id: userId } }))
      .mockResolvedValueOnce(okResponse({ id: userId, username: `user-${userId}` }))
    return authStore.login('editor', 'secret')
  }

  async function expireToken(authStore) {
    globalThis.fetch = vi.fn().mockResolvedValue(unauthorizedResponse())
    await strapiFetchJson({ profile: PROFILE, path: '/api/cards', token: authStore.token.value }).catch(() => {})
  }

  beforeEach(() => {
    globalThis.localStorage = createLocalStorageMock()
    useAuthStore().logout()
    useConnectionProfileStore().connectionProfile.value = PROFILE
  })

  test('a 401 during the session keeps the session and the user, but drops the token', async () => {
    const authStore = useAuthStore()
    await loginAs(authStore, 1)

    await expireToken(authStore)

    expect(authStore.authStatus.value).toBe('expired')
    expect(authStore.isAuthenticated.value).toBe(false)
    expect(authStore.hasOnlineSession.value).toBe(true)
    expect(authStore.sessionUserId.value).toBe('1')
    expect(authStore.token.value).toBe('')
    expect(globalThis.localStorage.getItem('viewerEditor.authToken.v1')).toBeNull()
    expect(authStore.lastAuthError.value).toContain('unsaved changes are kept')
  })

  test('a failed re-login keeps the expired session open', async () => {
    const authStore = useAuthStore()
    await loginAs(authStore, 1)
    await expireToken(authStore)

    globalThis.fetch = vi.fn().mockResolvedValue(unauthorizedResponse())
    const result = await authStore.login('editor', 'wrong')

    expect(result.ok).toBe(false)
    expect(authStore.hasOnlineSession.value).toBe(true)
    expect(authStore.sessionUserId.value).toBe('1')
  })

  test('logging in again closes the expiry without changing the session user', async () => {
    const authStore = useAuthStore()
    await loginAs(authStore, 1)
    await expireToken(authStore)

    await loginAs(authStore, 1)

    expect(authStore.sessionExpired.value).toBe(false)
    expect(authStore.isAuthenticated.value).toBe(true)
    expect(authStore.sessionUserId.value).toBe('1')
  })

  test('logout closes an expired session', async () => {
    const authStore = useAuthStore()
    await loginAs(authStore, 1)
    await expireToken(authStore)

    authStore.logout()

    expect(authStore.hasOnlineSession.value).toBe(false)
    expect(authStore.sessionUserId.value).toBe('')
  })

  test('a rejected stored token at startup is not treated as an expired session', async () => {
    globalThis.localStorage.setItem('viewerEditor.authToken.v1', 'stale')
    globalThis.fetch = vi.fn().mockResolvedValue(unauthorizedResponse())
    const authStore = useAuthStore()

    await authStore.restoreSession()

    expect(authStore.sessionExpired.value).toBe(false)
    expect(authStore.hasOnlineSession.value).toBe(false)
  })
})
