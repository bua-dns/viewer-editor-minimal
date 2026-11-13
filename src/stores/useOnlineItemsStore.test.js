import { beforeEach, describe, expect, test, vi } from 'vitest'
import { useConnectionProfileStore } from './useConnectionProfileStore'
import { useAuthStore } from './useAuthStore'
import { useOnlineItemsStore } from './useOnlineItemsStore'
import { createLocalStorageMock } from '../../test/helpers/storageMock.js'

describe('useOnlineItemsStore', () => {
  beforeEach(() => {
    globalThis.localStorage = createLocalStorageMock()
    const connectionStore = useConnectionProfileStore()
    const authStore = useAuthStore()
    const itemsStore = useOnlineItemsStore()

    connectionStore.clearConnectionProfile()
    authStore.logout()
    itemsStore.clearOnlineItems()

    connectionStore.connectionProfile.value = {
      version: 1,
      baseUrl: 'https://cms.example.org/project',
      configPath: '/api/viewer-setting',
    }
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

  describe('unassigned level-1 group', () => {
    const settings = {
      itemsPath: '/api/index-cards',
      hierarchyFields: ['level_1', 'level_2'],
      fields: { level_1: { type: 'normal' }, label: { type: 'normal' } },
    }
    const rows = [
      { documentId: 'a', level_1: null, label: 'one' },
      { documentId: 'b', level_1: '  ', label: 'two' },
    ]

    function itemsResponse(data) {
      return { ok: true, status: 200, json: async () => ({ data, meta: { pagination: { pageCount: 1 } } }) }
    }

    test('filters on the server for null or empty level-1 values', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(itemsResponse(rows))

      const result = await useOnlineItemsStore().fetchOnlineItemsForHierarchyLevel1({ settings, level1Value: '' })

      expect(result.ok).toBe(true)
      expect(result.items.map((item) => item.label)).toEqual(['one', 'two'])
      const query = new URLSearchParams(String(globalThis.fetch.mock.calls[0][0]).split('?')[1])
      expect(query.get('filters[$or][0][level_1][$null]')).toBe('true')
      expect(query.get('filters[$or][1][level_1][$eq]')).toBe('')
    })

    test('falls back to an unfiltered load when the server rejects the filter', async () => {
      globalThis.fetch = vi
        .fn()
        .mockResolvedValueOnce({ ok: false, status: 400, json: async () => ({ error: { message: 'Invalid filter' } }) })
        .mockResolvedValueOnce(itemsResponse([...rows, { documentId: 'c', level_1: 'A', label: 'three' }]))

      const result = await useOnlineItemsStore().fetchOnlineItemsForHierarchyLevel1({ settings, level1Value: '' })

      expect(result.ok).toBe(true)
      expect(result.items.map((item) => item.label)).toEqual(['one', 'two'])
      expect(String(globalThis.fetch.mock.calls[1][0])).not.toContain('filters')
    })
  })

  describe('searchOnlineItems', () => {
    const settings = {
      itemsPath: '/api/items',
      hierarchyFields: ['box', 'drawer'],
      fields: {
        label: { type: 'normal' },
        done: { type: 'checkbox' },
      },
    }

    test('searches the whole collection over text and hierarchy fields', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [
            { documentId: 'a', label: 'Oak tree', box: 'A' },
            { documentId: 'b', label: 'Old oak', box: 'B' },
          ],
          meta: { pagination: { pageCount: 1 } },
        }),
      })

      const store = useOnlineItemsStore()
      store.selectedHierarchyLevel1Value.value = 'A'
      const result = await store.searchOnlineItems({ settings, query: '  Oak ' })

      expect(result.ok).toBe(true)
      expect(result.items.map((item) => item.label)).toEqual(['Oak tree', 'Old oak'])
      expect(store.selectedHierarchyLevel1Value.value).toBe('A')
      const query = new URL(String(globalThis.fetch.mock.calls[0][0])).searchParams
      expect(query.get('filters[$and][0][$or][0][label][$containsi]')).toBe('oak')
      expect(query.get('filters[$and][0][$or][1][box][$containsi]')).toBe('oak')
      expect(query.get('filters[$and][0][$or][2][drawer][$containsi]')).toBe('oak')
      expect([...query.keys()].some((key) => key.includes('[done]'))).toBe(false)
    })

    test('leaves out excluded (structured) fields and reports them as not searched (review F2)', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: [], meta: { pagination: { pageCount: 1 } } }),
      })
      const store = useOnlineItemsStore()

      const loadExcludedFieldKeys = async () => ['drawer', 'unrelated']
      const result = await store.searchOnlineItems({ settings, query: 'oak', loadExcludedFieldKeys })

      expect(result.ok).toBe(true)
      expect(result.droppedFieldKeys).toEqual(['drawer'])
      const query = new URL(String(globalThis.fetch.mock.calls[0][0])).searchParams
      expect([...query.keys()].some((key) => key.includes('[drawer]'))).toBe(false)
      expect(query.get('filters[$and][0][$or][0][label][$containsi]')).toBe('oak')
    })

    test('refuses a query shorter than three characters without a request', async () => {
      globalThis.fetch = vi.fn()
      const store = useOnlineItemsStore()

      const loadExcludedFieldKeys = vi.fn(async () => [])

      const result = await store.searchOnlineItems({ settings, query: 'ab', loadExcludedFieldKeys })

      expect(result.ok).toBe(false)
      expect(globalThis.fetch).not.toHaveBeenCalled()
      expect(loadExcludedFieldKeys).not.toHaveBeenCalled()
    })

    test('reports a failed search and clears the items', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({ error: { message: 'Server down' } }),
      })
      const store = useOnlineItemsStore()
      store.items.value = [{ label: 'old' }]

      const result = await store.searchOnlineItems({ settings, query: 'oak' })

      expect(result).toEqual({ ok: false, error: 'Server down' })
      expect(store.items.value).toEqual([])
      expect(store.itemsStatus.value).toBe('error')
    })
  })
})
