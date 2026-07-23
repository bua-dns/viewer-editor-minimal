import { beforeEach, describe, expect, test, vi } from 'vitest'
import { useOnlineUpdatesStore } from './useOnlineUpdatesStore'

describe('useOnlineUpdatesStore', () => {
  beforeEach(() => {
    const store = useOnlineUpdatesStore()
    store.clearOnlineUpdates()
  })

  test('tracks changed field and removes it when reverted to snapshot value', () => {
    const store = useOnlineUpdatesStore()
    const item = {
      label: 'Updated',
      __onlineMeta: {
        id: 'doc-1',
        itemsPath: '/api/index-cards',
      },
    }
    const snapshotItem = {
      label: 'Original',
    }

    const tracked = store.trackOnlineFieldChange({
      item,
      snapshotItem,
      key: 'label',
      nextValue: 'Updated',
    })

    expect(tracked).toBe(true)
    expect(store.pendingUpdateCount.value).toBe(1)

    store.trackOnlineFieldChange({
      item,
      snapshotItem,
      key: 'label',
      nextValue: 'Original',
    })

    expect(store.pendingUpdateCount.value).toBe(0)
  })

  test('keeps failed updates and reports error', async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { id: 1 } }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: { message: 'boom' } }),
      })

    const store = useOnlineUpdatesStore()

    store.trackOnlineFieldChange({
      item: {
        label: 'A2',
        __onlineMeta: { id: 'doc-a', itemsPath: '/api/cards' },
      },
      snapshotItem: { label: 'A1' },
      key: 'label',
      nextValue: 'A2',
    })

    store.trackOnlineFieldChange({
      item: {
        label: 'B2',
        __onlineMeta: { id: 'doc-b', itemsPath: '/api/cards' },
      },
      snapshotItem: { label: 'B1' },
      key: 'label',
      nextValue: 'B2',
    })

    const result = await store.saveOnlineUpdates({
      profile: { baseUrl: 'https://cms.example.org' },
      token: 'jwt-1',
    })

    expect(result.ok).toBe(false)
    expect(result.savedCount).toBe(1)
    expect(result.failedCount).toBe(1)
    expect(store.saveStatus.value).toBe('error')
    expect(store.pendingUpdateCount.value).toBe(1)
    expect(store.lastSaveError.value).toContain('update(s) failed')
  })
})
