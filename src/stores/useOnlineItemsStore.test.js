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

  test('loads hierarchy level-1 options without fetching full item payload', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          { id: 1, level_1: 'A' },
          { id: 2, level_1: 'B' },
          { id: 3, level_1: 'A' },
          { id: 4, level_1: '' },
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
        hierarchyFields: ['level_1', 'level_2'],
        fields: {
          label: { type: 'normal' },
        },
      },
    })

    expect(result.ok).toBe(true)
    expect(result.hierarchyEnabled).toBe(true)
    expect(store.items.value).toEqual([])
    expect(store.hierarchyLevel1Options.value).toEqual([
      { value: 'A', count: 2, isUnassigned: false },
      { value: 'B', count: 1, isUnassigned: false },
      { value: '', count: 1, isUnassigned: true },
    ])

    const firstCallUrl = String(globalThis.fetch.mock.calls[0][0])
    expect(firstCallUrl).toContain('fields%5B0%5D=level_1')
  })

  test('uses firstLevelStaticList without loading online items', async () => {
    globalThis.fetch = vi.fn()

    const store = useOnlineItemsStore()
    const result = await store.fetchOnlineItems({
      settings: {
        itemsPath: '/api/index-cards',
        hierarchyFields: ['level_1', 'level_2'],
        firstLevelStaticList: [' 001 ', '002', '001', '', '003'],
        fields: {
          label: { type: 'normal' },
        },
      },
    })

    expect(result.ok).toBe(true)
    expect(result.hierarchyEnabled).toBe(true)
    expect(store.items.value).toEqual([])
    expect(store.hierarchyLevel1Options.value).toEqual([
      { value: '001', count: null, isUnassigned: false },
      { value: '002', count: null, isUnassigned: false },
      { value: '003', count: null, isUnassigned: false },
    ])
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })

  test('detects hierarchy from legacy hierarchy_fields key', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          { id: 1, level_1: 'A' },
          { id: 2, level_1: 'B' },
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
        hierarchy_fields: ['level_1', 'level_2'],
        fields: {
          level_1: { type: 'normal' },
          level_2: { type: 'normal' },
          label: { type: 'normal' },
        },
      },
    })

    expect(result.ok).toBe(true)
    expect(result.hierarchyEnabled).toBe(true)
    expect(store.items.value).toEqual([])
    expect(store.hierarchyFields.value).toEqual(['level_1', 'level_2'])
  })
})
