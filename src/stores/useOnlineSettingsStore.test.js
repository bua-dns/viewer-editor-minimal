import { beforeEach, describe, expect, test, vi } from 'vitest'
import { useAuthStore } from './useAuthStore'
import { useConnectionProfileStore } from './useConnectionProfileStore'
import { useOnlineSettingsStore } from './useOnlineSettingsStore'

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
  }
}

describe('useOnlineSettingsStore', () => {
  beforeEach(() => {
    globalThis.localStorage = createLocalStorageMock()
    const authStore = useAuthStore()
    const connectionStore = useConnectionProfileStore()
    const settingsStore = useOnlineSettingsStore()

    authStore.logout()
    connectionStore.clearConnectionProfile()
    settingsStore.clearOnlineSettings()

    connectionStore.saveConnectionProfile({
      baseUrl: 'https://cms.example.org/project',
      configPath: '/api/viewer-setting',
    })
  })

  test('loads settings from response.data.settings', async () => {
    const authStore = useAuthStore()
    authStore.token.value = 'token-1'

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          settings: {
            version: 1,
            fields: {},
          },
        },
      }),
    })

    const settingsStore = useOnlineSettingsStore()
    const result = await settingsStore.fetchOnlineSettings()

    expect(result.ok).toBe(true)
    expect(settingsStore.settingsStatus.value).toBe('ready')
    expect(settingsStore.settings.value.version).toBe(1)
  })
})
