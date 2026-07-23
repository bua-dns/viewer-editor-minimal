import { beforeEach, describe, expect, test, vi } from 'vitest'
import { useConnectionProfileStore } from './useConnectionProfileStore'
import { useAuthStore } from './useAuthStore'
import { useOnlineItemsStore } from './useOnlineItemsStore'

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

describe('useOnlineItemsStore', () => {
  beforeEach(() => {
    globalThis.localStorage = createLocalStorageMock()
    const connectionStore = useConnectionProfileStore()
    const authStore = useAuthStore()
    const itemsStore = useOnlineItemsStore()

    connectionStore.clearConnectionProfile()
    authStore.logout()
    itemsStore.clearOnlineItems()

    connectionStore.saveConnectionProfile({
      baseUrl: 'https://cms.example.org/project',
      configPath: '/api/viewer-setting',
    })
    authStore.token.value = 'token-1'
  })

  test('loads and sanitizes online items using settings.itemsPath', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          {
            id: 1,
            documentId: 'abc',
            label: '0_00571',
            date_indicated: '1956-01-12',
            scan: 'https://example.org/scan.jpg',
          },
        ],
        meta: {
          pagination: {
            pageCount: 1,
          },
        },
      }),
    })

    const store = useOnlineItemsStore()
    const result = await store.fetchOnlineItems({
      settings: {
        itemsPath: '/api/index-cards',
        fields: {
          label: { type: 'normal' },
          date_indicated: { type: 'normal' },
        },
      },
    })

    expect(result.ok).toBe(true)
    expect(store.itemsStatus.value).toBe('ready')
    expect(store.items.value[0]).toEqual({
      label: '0_00571',
      date_indicated: '1956-01-12',
      scan: 'https://example.org/scan.jpg',
      __onlineMeta: {
        id: 'abc',
        idKind: 'documentId',
        idValue: 'abc',
        itemsPath: '/api/index-cards',
        updatedAt: undefined,
      },
    })
  })

  test('supports Strapi attributes shape and falls back to numeric id', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          {
            id: 5,
            attributes: {
              label: 'A-5',
              scan: 'https://example.org/a5.jpg',
              updatedAt: '2026-07-22T11:00:00.000Z',
            },
          },
        ],
        meta: {
          pagination: {
            pageCount: 1,
          },
        },
      }),
    })

    const store = useOnlineItemsStore()
    const result = await store.fetchOnlineItems({
      settings: {
        itemsPath: '/api/index-cards?foo=bar',
        fields: {
          label: { type: 'normal' },
        },
      },
    })

    expect(result.ok).toBe(true)
    expect(store.items.value[0]).toEqual({
      label: 'A-5',
      scan: 'https://example.org/a5.jpg',
      __onlineMeta: {
        id: 5,
        idKind: 'id',
        idValue: 5,
        itemsPath: '/api/index-cards',
        updatedAt: '2026-07-22T11:00:00.000Z',
      },
    })
  })

  test('fails when online item has no stable identifier', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          {
            label: 'Missing id',
          },
        ],
        meta: {
          pagination: {
            pageCount: 1,
          },
        },
      }),
    })

    const store = useOnlineItemsStore()
    const result = await store.fetchOnlineItems({
      settings: {
        itemsPath: '/api/index-cards',
        fields: {
          label: { type: 'normal' },
        },
      },
    })

    expect(result.ok).toBe(false)
    expect(store.itemsStatus.value).toBe('error')
    expect(store.lastItemsError.value).toContain('stable identifier')
  })
})
