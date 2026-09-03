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

describe('useOnlineUpdatesStore draft creates', () => {
  beforeEach(() => {
    const store = useOnlineUpdatesStore()
    store.clearOnlineUpdates()
  })

  function createDraftItem(fields = {}) {
    return {
      inventory_number: '',
      reviewed: false,
      ...fields,
      __onlineMeta: {
        isDraft: true,
        draftId: 'draft-test-1',
        itemsPath: '/api/cards',
      },
    }
  }

  test('trackOnlineDraftCreate counts an untouched draft as pending', () => {
    const store = useOnlineUpdatesStore()
    const draft = createDraftItem()

    expect(store.trackOnlineDraftCreate({ item: draft })).toBe(true)
    expect(store.pendingUpdateCount.value).toBe(1)
    expect(store.hasPendingUpdates.value).toBe(true)
  })

  test('does not track persisted items as creates', () => {
    const store = useOnlineUpdatesStore()
    const persistedItem = {
      inventory_number: 'A1',
      __onlineMeta: { id: 'doc-1', itemsPath: '/api/cards' },
    }

    expect(store.trackOnlineDraftCreate({ item: persistedItem })).toBe(false)
    expect(store.pendingUpdateCount.value).toBe(0)
  })

  test('saveOnlineUpdates posts only non-empty draft fields and assigns the created documentId', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { id: 12, documentId: 'abc123', updatedAt: '2026-07-23T10:00:00Z' } }),
    })

    const store = useOnlineUpdatesStore()
    const draft = createDraftItem({ year: null, notes: '' })

    store.trackOnlineDraftCreate({ item: draft })
    store.trackOnlineFieldChange({ item: draft, snapshotItem: {}, key: 'inventory_number', nextValue: 'NEW-1' })
    store.trackOnlineFieldChange({ item: draft, snapshotItem: {}, key: 'reviewed', nextValue: false })
    store.trackOnlineFieldChange({ item: draft, snapshotItem: {}, key: 'year', nextValue: null })
    store.trackOnlineFieldChange({ item: draft, snapshotItem: {}, key: 'notes', nextValue: '' })

    const result = await store.saveOnlineUpdates({
      profile: { baseUrl: 'https://cms.example.org' },
      token: 'jwt-1',
    })

    expect(result.ok).toBe(true)
    expect(result.createdItems).toEqual([draft])

    const [requestUrl, requestInit] = globalThis.fetch.mock.calls[0]
    expect(requestUrl).toBe('https://cms.example.org/api/cards')
    expect(requestInit.method).toBe('POST')
    expect(JSON.parse(requestInit.body)).toEqual({ data: { inventory_number: 'NEW-1', reviewed: false } })

    expect(draft.__onlineMeta.isDraft).toBeUndefined()
    expect(draft.__onlineMeta.id).toBe('abc123')
    expect(draft.__onlineMeta.idKind).toBe('documentId')
    expect(store.pendingUpdateCount.value).toBe(0)
    expect(store.saveStatus.value).toBe('success')
  })

  test('failed create keeps the draft pending and reports an error', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: async () => ({ error: { message: 'Forbidden' } }),
    })

    const store = useOnlineUpdatesStore()
    const draft = createDraftItem()

    store.trackOnlineDraftCreate({ item: draft })
    store.trackOnlineFieldChange({ item: draft, snapshotItem: {}, key: 'inventory_number', nextValue: 'NEW-1' })

    const result = await store.saveOnlineUpdates({
      profile: { baseUrl: 'https://cms.example.org' },
      token: 'jwt-1',
    })

    expect(result.ok).toBe(false)
    expect(result.failedCount).toBe(1)
    expect(store.saveStatus.value).toBe('error')
    expect(store.lastSaveError.value).toContain('Forbidden')
    expect(store.pendingUpdateCount.value).toBe(1)
    expect(draft.__onlineMeta.isDraft).toBe(true)
  })

  test('created item switches to the regular update path for later edits', async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { id: 12, documentId: 'abc123' } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { id: 12, documentId: 'abc123' } }),
      })

    const store = useOnlineUpdatesStore()
    const draft = createDraftItem()

    store.trackOnlineDraftCreate({ item: draft })
    const createResult = await store.saveOnlineUpdates({
      profile: { baseUrl: 'https://cms.example.org' },
      token: 'jwt-1',
    })
    expect(createResult.ok).toBe(true)

    store.trackOnlineFieldChange({
      item: draft,
      snapshotItem: { inventory_number: '' },
      key: 'inventory_number',
      nextValue: 'EDIT-2',
    })

    expect(store.pendingUpdateCount.value).toBe(1)

    const updateResult = await store.saveOnlineUpdates({
      profile: { baseUrl: 'https://cms.example.org' },
      token: 'jwt-1',
    })

    expect(updateResult.ok).toBe(true)
    const [updateUrl, updateInit] = globalThis.fetch.mock.calls[1]
    expect(updateUrl).toBe('https://cms.example.org/api/cards/abc123')
    expect(updateInit.method).toBe('PUT')
    expect(JSON.parse(updateInit.body)).toEqual({ data: { inventory_number: 'EDIT-2' } })
    expect(store.pendingUpdateCount.value).toBe(0)
  })
  test('replacements run tracks updates for collection items that are not loaded', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          { id: 1, documentId: 'doc-1', place: 'Gruenberg i. Schl.' },
          { id: 2, documentId: 'doc-2', place: 'Berlin' },
          { id: 3, documentId: 'doc-3', place: 'Sagan i. Schl.' },
        ],
        meta: { pagination: { page: 1, pageCount: 1 } },
      }),
    })

    const store = useOnlineUpdatesStore()
    const result = await store.trackOnlineReplacementUpdatesForRemainingItems({
      profile: { baseUrl: 'https://cms.example.org' },
      token: 'jwt-1',
      settings: { itemsPath: '/api/cards', fields: { place: { type: 'normal' } } },
      replacements: { allFields: { 'i. Schl.': 'in Schlesien' } },
      fieldConfigs: { place: { type: 'normal' } },
      loadedIds: ['doc-1'],
    })

    expect(result.ok).toBe(true)
    expect(result.scannedCount).toBe(3)
    expect(result.changedItemCount).toBe(1)
    expect(result.changedFieldCount).toBe(1)
    expect(store.pendingUpdateCount.value).toBe(1)

    const entry = Object.values(store.pendingUpdatesById.value)[0]
    expect(entry.id).toBe('doc-3')
    expect(entry.changedFields).toEqual({ place: 'Sagan in Schlesien' })
  })

  test('replacements run reports a failed collection fetch without pending updates', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: { message: 'boom' } }),
    })

    const store = useOnlineUpdatesStore()
    const result = await store.trackOnlineReplacementUpdatesForRemainingItems({
      profile: { baseUrl: 'https://cms.example.org' },
      token: 'jwt-1',
      settings: { itemsPath: '/api/cards' },
      replacements: { allFields: { a: 'b' } },
      fieldConfigs: { place: { type: 'normal' } },
      loadedIds: [],
    })

    expect(result.ok).toBe(false)
    expect(result.error).toBe('boom')
    expect(store.pendingUpdateCount.value).toBe(0)
  })

  test('replacements run requires an itemsPath', async () => {
    const store = useOnlineUpdatesStore()
    const result = await store.trackOnlineReplacementUpdatesForRemainingItems({
      profile: { baseUrl: 'https://cms.example.org' },
      settings: {},
      replacements: { allFields: { a: 'b' } },
      fieldConfigs: {},
    })

    expect(result.ok).toBe(false)
    expect(store.pendingUpdateCount.value).toBe(0)
  })
})
