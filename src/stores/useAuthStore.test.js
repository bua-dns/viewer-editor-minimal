import { beforeEach, describe, expect, test, vi } from 'vitest'
import { useAuthStore } from './useAuthStore'
import { useConnectionProfileStore } from './useConnectionProfileStore'

function createLocalStorageMock() {
  const store = new Map()
  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null
    },
    setItem(key, value) {
      store.set(key, String(value))
    },
    removeItem(key) {
      store.delete(key)
    },
    clear() {
      store.clear()
    },
  }
}

describe('useAuthStore', () => {
  beforeEach(() => {
    globalThis.localStorage = createLocalStorageMock()
    const authStore = useAuthStore()
    const connectionStore = useConnectionProfileStore()
    authStore.logout()
    connectionStore.clearConnectionProfile()
    connectionStore.saveConnectionProfile({
      label: 'Test',
      baseUrl: 'https://cms.example.org/project',
      configPath: '/api/viewer-setting',
    })
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
