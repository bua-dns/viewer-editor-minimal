import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { useAppConfigStore } from './useAppConfigStore'
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

    connectionStore.connectionProfile.value = {
      version: 1,
      baseUrl: 'https://cms.example.org/project',
      configPath: '/api/viewer-setting',
    }
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
      signal: expect.any(AbortSignal),
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
  test('persists replacements against the config singleton', async () => {
    const authStore = useAuthStore()
    authStore.token.value = 'token-1'

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { replacements: { allFields: { a: 'b' } } } }),
    })

    const settingsStore = useOnlineSettingsStore()
    const result = await settingsStore.persistOnlineReplacements({ allFields: { a: 'b' } })

    expect(result.ok).toBe(true)
    expect(settingsStore.settingsStatus.value).toBe('ready')
    const [url, init] = globalThis.fetch.mock.calls[0]
    expect(url).toBe('https://cms.example.org/project/api/viewer-setting')
    expect(JSON.parse(init.body)).toEqual({ data: { replacements: { allFields: { a: 'b' } } } })
  })

  test('reports an error when replacements cannot be persisted', async () => {
    const authStore = useAuthStore()
    authStore.token.value = 'token-1'

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: { message: 'Invalid key replacements' } }),
    })

    const settingsStore = useOnlineSettingsStore()
    const result = await settingsStore.persistOnlineReplacements({})

    expect(result.ok).toBe(false)
    expect(settingsStore.settingsStatus.value).toBe('error')
    expect(settingsStore.lastSettingsError.value).toBe('Invalid key replacements')
  })

  describe('collection layout (v2)', () => {
    const record = {
      settings: { itemsPath: '/api/old' },
      wording: { appTitle: { de: 'Shared' } },
      index_cards: {
        itemsPath: '/api/index-cards',
        fields: { label: { type: 'normal' } },
        primaryColor: '#ff0000',
        replacements: { label: { a: 'b' } },
      },
      collection_items: { itemsPath: '/api/collection-items', fields: {} },
    }

    function respondWith(...bodies) {
      globalThis.fetch = vi.fn()
      bodies.forEach((body) => {
        globalThis.fetch.mockResolvedValueOnce({ ok: true, json: async () => body })
      })
    }

    beforeEach(() => {
      useAuthStore().token.value = 'token-1'
      useAppConfigStore().applyBasicConfig({
        primaryCollection: 'index_cards',
        secondaryCollections: ['collection_items'],
      })
    })

    afterEach(() => {
      useAppConfigStore().applyBasicConfig({})
    })

    test('loads the primary attribute as settings, without viewer settings and replacements', async () => {
      respondWith({ data: record })
      const store = useOnlineSettingsStore()
      const result = await store.fetchOnlineSettings()

      expect(result.ok).toBe(true)
      expect(store.isCollectionLayout.value).toBe(true)
      expect(store.settings.value).toEqual({ itemsPath: '/api/index-cards', fields: { label: { type: 'normal' } } })
      expect(result.replacements).toEqual({ label: { a: 'b' } })
      expect(store.secondaryCollections.value).toEqual([
        { id: 'collection_items', config: record.collection_items, error: '' },
      ])
      expect(store.wording.value.appTitle.de).toBe('Shared')
    })

    test('fails clearly when the primary attribute is missing', async () => {
      respondWith({ data: { settings: {} } })
      const store = useOnlineSettingsStore()
      const result = await store.fetchOnlineSettings()

      expect(result.ok).toBe(false)
      expect(result.error).toContain('"index_cards"')
      expect(store.settings.value).toBe(null)
    })

    test('writes field config into the primary attribute and keeps its replacements', async () => {
      respondWith({ data: record })
      const store = useOnlineSettingsStore()
      await store.fetchOnlineSettings()

      respondWith({ data: record }, { data: { index_cards: { ...record.index_cards, fields: {} } } })
      const result = await store.persistOnlineSettings({ itemsPath: '/api/index-cards', fields: {}, language: 'en' })

      expect(result.ok).toBe(true)
      const [, init] = globalThis.fetch.mock.calls[1]
      expect(JSON.parse(init.body)).toEqual({
        data: { index_cards: { itemsPath: '/api/index-cards', fields: {}, replacements: { label: { a: 'b' } } } },
      })
      expect(store.settings.value).toEqual({ itemsPath: '/api/index-cards', fields: {} })
    })

    test('writes replacements into the primary attribute', async () => {
      respondWith({ data: record })
      const store = useOnlineSettingsStore()
      await store.fetchOnlineSettings()

      respondWith({ data: record }, { data: { index_cards: { ...record.index_cards, replacements: { x: {} } } } })
      const result = await store.persistOnlineReplacements({ x: {} })

      expect(result).toMatchObject({ ok: true, replacements: { x: {} } })
      const [, init] = globalThis.fetch.mock.calls[1]
      expect(JSON.parse(init.body).data.index_cards.replacements).toEqual({ x: {} })
      expect(JSON.parse(init.body).data.index_cards.fields).toEqual({ label: { type: 'normal' } })
    })

    test('resolves the settings of the collection an item belongs to', async () => {
      respondWith({ data: record })
      const store = useOnlineSettingsStore()
      await store.fetchOnlineSettings()

      expect(store.settingsForItemsPath('/api/collection-items/').itemsPath).toBe('/api/collection-items')
      expect(store.settingsForItemsPath('/api/index-cards').fields).toEqual({ label: { type: 'normal' } })
      expect(store.settingsForItemsPath('/api/unknown').itemsPath).toBe('/api/index-cards')
    })

    test('writes a secondary collection into its own attribute', async () => {
      respondWith({ data: record })
      const store = useOnlineSettingsStore()
      await store.fetchOnlineSettings()

      const saved = { itemsPath: '/api/collection-items', fields: { name: {} } }
      respondWith({ data: record }, { data: { collection_items: saved } })
      const result = await store.persistSecondaryCollectionSettings('collection_items', { fields: { name: {} } })

      expect(result.ok).toBe(true)
      const [, init] = globalThis.fetch.mock.calls[1]
      expect(Object.keys(JSON.parse(init.body).data)).toEqual(['collection_items'])
      expect(store.secondaryCollections.value[0].config).toEqual(saved)
    })
  })
})
