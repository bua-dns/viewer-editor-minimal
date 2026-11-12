import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { useOnlineUpdatesStore } from './useOnlineUpdatesStore'
import { useOnlineSettingsStore } from './useOnlineSettingsStore'

const PROFILE = { baseUrl: 'https://cms.example.org' }

function okResponse(body) {
  return { ok: true, status: 200, json: async () => body }
}

function errorResponse(status, message) {
  return { ok: false, status, json: async () => ({ error: { message } }) }
}

/**
 * Fetch mock routed by "METHOD /path" (query ignored). A route value is a response, a function
 * returning one (or a promise of one), or an array consumed one response per call.
 */
function mockStrapiFetch(routes) {
  return vi.fn(async (url, init = {}) => {
    const path = new URL(url).pathname
    const routeKey = `${init.method || 'GET'} ${path}`
    const route = routes[routeKey]
    if (!route) throw new Error(`Unexpected request: ${routeKey}`)
    if (Array.isArray(route)) return route.shift()
    return typeof route === 'function' ? route(init) : route
  })
}

function deferred() {
  let resolve
  const promise = new Promise((resolvePromise) => {
    resolve = resolvePromise
  })
  return { promise, resolve }
}

function requestsOf(fetchMock, method) {
  return fetchMock.mock.calls.filter(([, init = {}]) => (init.method || 'GET') === method)
}

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
    globalThis.fetch = mockStrapiFetch({
      'GET /api/cards/doc-a': okResponse({ data: { documentId: 'doc-a', label: 'A1' } }),
      'PUT /api/cards/doc-a': okResponse({ data: { id: 1 } }),
      'GET /api/cards/doc-b': okResponse({ data: { documentId: 'doc-b', label: 'B1' } }),
      'PUT /api/cards/doc-b': errorResponse(500, 'boom'),
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
    expect(store.hasPendingChangesForItem(draft)).toBe(true)
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
    globalThis.fetch = mockStrapiFetch({
      'POST /api/cards': okResponse({ data: { id: 12, documentId: 'abc123' } }),
      'GET /api/cards/abc123': okResponse({ data: { id: 12, documentId: 'abc123', inventory_number: '' } }),
      'PUT /api/cards/abc123': okResponse({ data: { id: 12, documentId: 'abc123' } }),
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
    const [[updateUrl, updateInit]] = requestsOf(globalThis.fetch, 'PUT')
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

describe('useOnlineUpdatesStore save safety', () => {
  beforeEach(() => {
    useOnlineUpdatesStore().clearOnlineUpdates()
  })

  function trackLabelEdit(store, { from, to, id = 'doc-1' }) {
    const item = { label: to, __onlineMeta: { id, itemsPath: '/api/cards' } }
    store.trackOnlineFieldChange({ item, snapshotItem: { label: from }, key: 'label', nextValue: to })
    return item
  }

  function editLabel(store, item, nextValue, snapshotLabel = 'Original') {
    item.label = nextValue
    store.trackOnlineFieldChange({ item, snapshotItem: { label: snapshotLabel }, key: 'label', nextValue })
  }

  test('refuses to overwrite a field someone else changed, and overwrites on the second save', async () => {
    globalThis.fetch = mockStrapiFetch({
      'GET /api/cards/doc-1': okResponse({ data: { documentId: 'doc-1', label: 'Their edit' } }),
      'PUT /api/cards/doc-1': okResponse({ data: { documentId: 'doc-1' } }),
    })
    const store = useOnlineUpdatesStore()
    trackLabelEdit(store, { from: 'Original', to: 'My edit' })

    const first = await store.saveOnlineUpdates({ profile: PROFILE })

    expect(first.ok).toBe(false)
    expect(first.error).toContain('label changed on the server')
    expect(requestsOf(globalThis.fetch, 'PUT')).toHaveLength(0)
    expect(store.pendingUpdateCount.value).toBe(1)

    const second = await store.saveOnlineUpdates({ profile: PROFILE })

    expect(second.ok).toBe(true)
    const [[, putInit]] = requestsOf(globalThis.fetch, 'PUT')
    expect(JSON.parse(putInit.body)).toEqual({ data: { label: 'My edit' } })
    expect(store.pendingUpdateCount.value).toBe(0)
  })

  test('does not report a conflict when only other fields changed on the server', async () => {
    globalThis.fetch = mockStrapiFetch({
      'GET /api/cards/doc-1': okResponse({ data: { documentId: 'doc-1', label: 'Original', notes: 'new note' } }),
      'PUT /api/cards/doc-1': okResponse({ data: { documentId: 'doc-1' } }),
    })
    const store = useOnlineUpdatesStore()
    trackLabelEdit(store, { from: 'Original', to: 'My edit' })

    const result = await store.saveOnlineUpdates({ profile: PROFILE })

    expect(result.ok).toBe(true)
    const [[, putInit]] = requestsOf(globalThis.fetch, 'PUT')
    expect(JSON.parse(putInit.body)).toEqual({ data: { label: 'My edit' } })
  })

  test('saveOnlineItem writes only the given item and leaves the others pending', async () => {
    globalThis.fetch = mockStrapiFetch({
      'GET /api/cards/doc-1': okResponse({ data: { documentId: 'doc-1', label: 'Original' } }),
      'PUT /api/cards/doc-1': okResponse({ data: { documentId: 'doc-1' } }),
    })
    const store = useOnlineUpdatesStore()
    const first = trackLabelEdit(store, { from: 'Original', to: 'Mine', id: 'doc-1' })
    const second = trackLabelEdit(store, { from: 'Original', to: 'Later', id: 'doc-2' })

    expect(store.hasPendingChangesForItem(first)).toBe(true)
    const result = await store.saveOnlineItem({ profile: PROFILE, item: first })

    expect(result.ok).toBe(true)
    expect(requestsOf(globalThis.fetch, 'PUT')).toHaveLength(1)
    expect(store.hasPendingChangesForItem(first)).toBe(false)
    expect(store.hasPendingChangesForItem(second)).toBe(true)
    expect(store.pendingUpdateCount.value).toBe(1)
  })

  test('saveOnlineItem without pending changes for the item sends nothing', async () => {
    globalThis.fetch = mockStrapiFetch({})
    const store = useOnlineUpdatesStore()
    const item = { label: 'Same', __onlineMeta: { id: 'doc-9', itemsPath: '/api/cards' } }

    const result = await store.saveOnlineItem({ profile: PROFILE, item })

    expect(result.ok).toBe(true)
    expect(globalThis.fetch).not.toHaveBeenCalled()
    expect(store.hasPendingChangesForItem(null)).toBe(false)
  })

  // Saves "Original" → "First" and runs `editDuringPut` while the PUT is still open.
  async function saveWithEditDuringPut(store, editDuringPut) {
    const putGate = deferred()
    globalThis.fetch = mockStrapiFetch({
      'GET /api/cards/doc-1': okResponse({ data: { documentId: 'doc-1', label: 'Original' } }),
      'PUT /api/cards/doc-1': () => putGate.promise,
    })
    const item = trackLabelEdit(store, { from: 'Original', to: 'First' })

    const saving = store.saveOnlineUpdates({ profile: PROFILE })
    await vi.waitFor(() => expect(requestsOf(globalThis.fetch, 'PUT')).toHaveLength(1))
    editDuringPut(item)
    putGate.resolve(okResponse({ data: { documentId: 'doc-1' } }))
    await saving
  }

  test('an edit made while the save is running stays pending', async () => {
    const store = useOnlineUpdatesStore()
    await saveWithEditDuringPut(store, (item) => editLabel(store, item, 'Second'))

    const entry = Object.values(store.pendingUpdatesById.value)[0]
    expect(entry.changedFields).toEqual({ label: 'Second' })
    expect(entry.baselineFields).toEqual({ label: 'First' })

    globalThis.fetch = mockStrapiFetch({
      'GET /api/cards/doc-1': okResponse({ data: { documentId: 'doc-1', label: 'First' } }),
      'PUT /api/cards/doc-1': okResponse({ data: { documentId: 'doc-1' } }),
    })
    const next = await store.saveOnlineUpdates({ profile: PROFILE })
    expect(next.ok).toBe(true)
    expect(store.pendingUpdateCount.value).toBe(0)
  })

  test('a revert made while the save is running is sent with the next save', async () => {
    const store = useOnlineUpdatesStore()
    await saveWithEditDuringPut(store, (item) => {
      editLabel(store, item, 'Original')
      expect(store.pendingUpdateCount.value).toBe(0)
    })

    const entry = Object.values(store.pendingUpdatesById.value)[0]
    expect(entry.changedFields).toEqual({ label: 'Original' })
    expect(entry.baselineFields).toEqual({ label: 'First' })
  })

  test('an edit made while a draft is being created becomes an update of the new item', async () => {
    const postGate = deferred()
    globalThis.fetch = mockStrapiFetch({
      'POST /api/cards': () => postGate.promise,
    })
    const store = useOnlineUpdatesStore()
    const draft = {
      label: 'First',
      __onlineMeta: { isDraft: true, draftId: 'draft-1', itemsPath: '/api/cards' },
    }
    store.trackOnlineDraftCreate({ item: draft })
    store.trackOnlineFieldChange({ item: draft, snapshotItem: {}, key: 'label', nextValue: 'First' })

    const saving = store.saveOnlineUpdates({ profile: PROFILE })
    await vi.waitFor(() => expect(requestsOf(globalThis.fetch, 'POST')).toHaveLength(1))
    draft.label = 'Second'
    store.trackOnlineFieldChange({ item: draft, snapshotItem: {}, key: 'label', nextValue: 'Second' })
    postGate.resolve(okResponse({ data: { id: 5, documentId: 'new-1' } }))
    await saving

    expect(store.pendingCreatesById.value).toEqual({})
    const entry = Object.values(store.pendingUpdatesById.value)[0]
    expect(entry.id).toBe('new-1')
    expect(entry.changedFields).toEqual({ label: 'Second' })
    expect(entry.baselineFields).toEqual({ label: 'First' })
  })
})

describe('useOnlineUpdatesStore creates with an unknown outcome (review F6)', () => {
  const settingsStore = useOnlineSettingsStore()

  beforeEach(() => {
    useOnlineUpdatesStore().clearOnlineUpdates()
  })

  afterEach(() => {
    settingsStore.clearOnlineSettings()
  })

  function trackDraft(store) {
    const draft = {
      label: 'New',
      __onlineMeta: { isDraft: true, draftId: 'draft-1', itemsPath: '/api/cards' },
    }
    store.trackOnlineDraftCreate({ item: draft })
    store.trackOnlineFieldChange({ item: draft, snapshotItem: {}, key: 'label', nextValue: 'New' })
    return draft
  }

  test('without createKeyField the error warns that the item may exist', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))
    const store = useOnlineUpdatesStore()
    trackDraft(store)

    const result = await store.saveOnlineUpdates({ profile: PROFILE })

    expect(result.ok).toBe(false)
    expect(store.lastSaveError.value).toContain('may have been stored anyway')
    expect(store.lastSaveError.value).toContain('Check the collection before saving again')
    expect(store.pendingUpdateCount.value).toBe(1)
  })

  test('with createKeyField the next save finds the stored item instead of posting again', async () => {
    settingsStore.settings.value = { itemsPath: '/api/cards', createKeyField: 'client_key' }
    let sentKey = ''
    globalThis.fetch = mockStrapiFetch({
      'POST /api/cards': (init) => {
        sentKey = JSON.parse(init.body).data.client_key
        return Promise.reject(new TypeError('Failed to fetch'))
      },
      'GET /api/cards': () => okResponse({ data: [{ id: 7, documentId: 'stored-1', client_key: sentKey }] }),
    })
    const store = useOnlineUpdatesStore()
    const draft = trackDraft(store)

    const first = await store.saveOnlineUpdates({ profile: PROFILE })
    const second = await store.saveOnlineUpdates({ profile: PROFILE })

    expect(first.ok).toBe(false)
    expect(sentKey).not.toBe('')
    expect(second.ok).toBe(true)
    expect(requestsOf(globalThis.fetch, 'POST')).toHaveLength(1)
    const lookupUrl = decodeURIComponent(requestsOf(globalThis.fetch, 'GET')[0][0])
    expect(lookupUrl).toContain(`filters[client_key][$eq]=${sentKey}`)
    expect(draft.__onlineMeta.id).toBe('stored-1')
    expect(store.pendingUpdateCount.value).toBe(0)
  })

  test('with createKeyField a create that was not stored is posted again with the same key', async () => {
    settingsStore.settings.value = { itemsPath: '/api/cards', createKeyField: 'client_key' }
    const sentKeys = []
    globalThis.fetch = vi.fn(async (_url, init = {}) => {
      if (init.method === 'POST') {
        sentKeys.push(JSON.parse(init.body).data.client_key)
        if (sentKeys.length === 1) throw new TypeError('Failed to fetch')
        return okResponse({ data: { id: 8, documentId: 'new-8' } })
      }
      return okResponse({ data: [] })
    })
    const store = useOnlineUpdatesStore()
    trackDraft(store)

    await store.saveOnlineUpdates({ profile: PROFILE })
    const second = await store.saveOnlineUpdates({ profile: PROFILE })

    expect(second.ok).toBe(true)
    expect(sentKeys).toHaveLength(2)
    expect(sentKeys[1]).toBe(sentKeys[0])
  })
})
