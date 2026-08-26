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
          wording: {
            appTitle: {
              de: 'Online Titel',
            },
          },
        },
      }),
    })

    const settingsStore = useOnlineSettingsStore()
    const result = await settingsStore.fetchOnlineSettings()

    expect(result.ok).toBe(true)
    expect(settingsStore.settingsStatus.value).toBe('ready')
    expect(settingsStore.settings.value.version).toBe(1)
    expect(settingsStore.wording.value.appTitle.de).toBe('Online Titel')
  })

  test('persists updated settings to singleton endpoint', async () => {
    const authStore = useAuthStore()
    authStore.token.value = 'token-1'

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          settings: {
            version: 1,
            fields: {
              label: { type: 'normal', label: 'Label', order: 0 },
            },
          },
        },
      }),
    })

    const settingsStore = useOnlineSettingsStore()
    const result = await settingsStore.persistOnlineSettings({
      version: 1,
      fields: {
        label: { type: 'normal', label: 'Label', order: 0 },
      },
    })

    expect(result.ok).toBe(true)
    expect(settingsStore.settingsStatus.value).toBe('ready')
    expect(settingsStore.settings.value.fields.label.label).toBe('Label')
    expect(globalThis.fetch).toHaveBeenCalledWith('https://cms.example.org/project/api/viewer-setting', {
      method: 'PUT',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: 'Bearer token-1',
      },
      body: JSON.stringify({
        data: {
          settings: {
            version: 1,
            fields: {
              label: { type: 'normal', label: 'Label', order: 0 },
            },
          },
        },
      }),
    })
  })

  test('keeps local state when persist fails', async () => {
    const settingsStore = useOnlineSettingsStore()
    settingsStore.settings.value = {
      version: 1,
      fields: {
        existing: { type: 'normal', label: 'Existing', order: 0 },
      },
    }

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: { message: 'Server exploded' } }),
    })

    const result = await settingsStore.persistOnlineSettings({
      version: 1,
      fields: {
        changed: { type: 'normal', label: 'Changed', order: 0 },
      },
    })

    expect(result.ok).toBe(false)
    expect(settingsStore.settingsStatus.value).toBe('error')
    expect(settingsStore.lastSettingsError.value).toBe('Server exploded')
    expect(settingsStore.settings.value.fields.existing.label).toBe('Existing')
  })
})
