import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { nextTick, ref } from 'vue'
import { useAppConfigStore } from '../stores/useAppConfigStore'
import { useAuthStore } from '../stores/useAuthStore'
import { useConnectionProfileStore } from '../stores/useConnectionProfileStore'
import { useOnlineModeStore } from '../stores/useOnlineModeStore'
import { useOnlineSettingsStore } from '../stores/useOnlineSettingsStore'
import { useOnlineUpdatesStore } from '../stores/useOnlineUpdatesStore'
import { useUserConfigStore } from '../stores/useUserConfigStore'
import { useSecondaryItems } from './useSecondaryItems'

const record = {
  index_cards: { itemsPath: '/api/index-cards', fields: { label: { type: 'normal' } } },
  collection_items: {
    itemsPath: '/api/collection-items',
    label: { de: 'Sammlungsobjekte' },
    itemLabelField: 'label',
    fields: { label: { type: 'normal' }, remarks: { type: 'text' } },
    relations: { index_cards: 'index_cards' },
  },
}

const linkedRows = [
  { documentId: 'ci-1', label: 'item_1', remarks: null, updatedAt: 'x' },
  { documentId: 'ci-2', label: 'item_2', remarks: 'r', updatedAt: 'x' },
]

function json(body) {
  return { ok: true, status: 200, json: async () => body }
}

function cardItem(id) {
  return { label: id, __onlineMeta: { id, idKind: 'documentId', itemsPath: '/api/index-cards' } }
}

async function flush() {
  for (let i = 0; i < 6; i += 1) await nextTick()
  await new Promise((resolve) => setTimeout(resolve, 0))
}

async function setup({ confirmed = true } = {}) {
  globalThis.fetch = vi.fn(async (url, init) => {
    if (init?.method === 'DELETE') return { ok: true, status: 204, json: async () => { throw new Error('no body') } }
    if (init?.method === 'PUT') return json({ data: {} })
    if (String(url).includes('/api/collection-items')) return json({ data: linkedRows })
    return json({ data: record })
  })
  await useOnlineSettingsStore().fetchOnlineSettings()
  const selectedItem = ref(null)
  const saveItem = vi.fn(async () => true)
  const confirmAction = vi.fn(() => confirmed)
  const secondary = useSecondaryItems({ selectedItem, saveItem, confirmAction })
  secondary.initialize()
  return { secondary, selectedItem, saveItem, confirmAction }
}

function lastRequest() {
  const [url, init] = globalThis.fetch.mock.calls.at(-1)
  return { url: decodeURIComponent(String(url)), method: init?.method, body: init?.body ? JSON.parse(init.body) : null }
}

describe('useSecondaryItems', () => {
  beforeEach(() => {
    globalThis.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} }
    useConnectionProfileStore().connectionProfile.value = {
      version: 1,
      baseUrl: 'https://cms.example.org',
      configPath: '/api/viewer-setting',
    }
    useAuthStore().token.value = 't'
    useAuthStore().authStatus.value = 'authenticated'
    useOnlineModeStore().appMode.value = 'online'
    useAppConfigStore().applyBasicConfig({ primaryCollection: 'index_cards', secondaryCollections: ['collection_items'] })
    useOnlineUpdatesStore().clearOnlineUpdates()
  })

  afterEach(() => {
    useAppConfigStore().applyBasicConfig({})
    useOnlineSettingsStore().clearOnlineSettings()
  })

  test('builds one section per secondary collection with its own field configuration', async () => {
    const { secondary } = await setup()
    expect(secondary.sections.value).toHaveLength(1)
    expect(secondary.sections.value[0]).toMatchObject({ id: 'collection_items', status: 'idle', error: '' })
    const scopeFields = useUserConfigStore(secondary.sections.value[0].scope).appliedUserConfigFields.value
    expect(Object.keys(scopeFields)).toEqual(['label', 'remarks'])
    expect(Object.keys(useUserConfigStore().appliedUserConfigFields.value)).not.toContain('remarks')
  })

  test('loads the items linked to the selected item through the configured relation', async () => {
    const { secondary, selectedItem } = await setup()
    selectedItem.value = cardItem('card-1')
    await flush()

    const section = secondary.sections.value[0]
    expect(section.status).toBe('ready')
    expect(section.items.map((item) => item.label)).toEqual(['item_1', 'item_2'])
    expect(section.items[0].remarks).toBe(null)
    expect(section.openKeys).toEqual([])
    const linkedUrl = decodeURIComponent(String(globalThis.fetch.mock.calls.at(-1)[0]))
    expect(linkedUrl).toContain('filters[index_cards][documentId][$eq]=card-1')
  })

  test('an edit becomes a pending update and survives reloading the item', async () => {
    const { secondary, selectedItem } = await setup()
    selectedItem.value = cardItem('card-1')
    await flush()

    const item = secondary.sections.value[0].items[0]
    secondary.changeField(item, 'remarks', 'new remark', 'text')
    const updates = useOnlineUpdatesStore()
    expect(updates.pendingUpdateCount.value).toBe(1)
    expect(updates.hasPendingChangesForItem(item)).toBe(true)

    selectedItem.value = cardItem('card-2')
    await flush()
    selectedItem.value = cardItem('card-1')
    await flush()
    expect(secondary.sections.value[0].items[0].remarks).toBe('new remark')
  })

  test('reverting an edit removes the pending update', async () => {
    const { secondary, selectedItem } = await setup()
    selectedItem.value = cardItem('card-1')
    await flush()

    const item = secondary.sections.value[0].items[1]
    secondary.changeField(item, 'remarks', 'changed', 'text')
    secondary.changeField(item, 'remarks', 'r', 'text')
    expect(useOnlineUpdatesStore().pendingUpdateCount.value).toBe(0)
  })

  test('after deriving, the new item is opened', async () => {
    const { secondary, selectedItem } = await setup()
    selectedItem.value = cardItem('card-1')
    await flush()

    secondary.reloadAfterCreate({ targetPath: '/api/collection-items', documentId: 'ci-2' })
    await flush()
    expect(secondary.sections.value[0].openKeys).toEqual(['/api/collection-items::ci-2'])
  })

  test('a draft primary item shows no linked items', async () => {
    const { secondary, selectedItem } = await setup()
    selectedItem.value = { __onlineMeta: { isDraft: true, draftId: 'd1', itemsPath: '/api/index-cards' } }
    await flush()
    expect(secondary.sections.value[0].status).toBe('idle')
  })

  test('applying a secondary configuration writes only that collection attribute', async () => {
    const { secondary, selectedItem } = await setup()
    selectedItem.value = cardItem('card-1')
    await flush()

    const section = secondary.sections.value[0]
    const store = useUserConfigStore(section.scope)
    store.newFieldName.value = 'status'
    store.addUserConfigField((_key, fallback) => fallback)

    const savedConfig = { ...record.collection_items, fields: { ...record.collection_items.fields, status: {} } }
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce(json({ data: record }))
      .mockResolvedValueOnce(json({ data: { collection_items: savedConfig } }))
    const result = await secondary.applyCollectionConfig(section)

    expect(result.ok).toBe(true)
    const sent = JSON.parse(globalThis.fetch.mock.calls[1][1].body).data
    expect(Object.keys(sent)).toEqual(['collection_items'])
    expect(Object.keys(sent.collection_items.fields)).toEqual(['label', 'remarks', 'status'])
    expect(sent.collection_items.relations).toEqual({ index_cards: 'index_cards' })
    expect(section.items[0].status).toBe('')
  })

  describe('reloading the collection configuration', () => {
    const changedRecord = {
      ...record,
      collection_items: {
        ...record.collection_items,
        fields: { ...record.collection_items.fields, collectors: { type: 'wikidata-autosuggest', autosuggest: { limit: 50 } } },
      },
    }

    test('reads the configuration changed elsewhere and applies it to the tab', async () => {
      const { secondary, confirmAction } = await setup()
      const section = secondary.sections.value[0]
      globalThis.fetch = vi.fn(async () => json({ data: changedRecord }))

      const result = await secondary.reloadCollectionConfig(section)

      expect(result).toEqual({ ok: true })
      expect(confirmAction).not.toHaveBeenCalled()
      expect(section.settings.fields.collectors.type).toBe('wikidata-autosuggest')
      const scopeFields = useUserConfigStore(section.scope).appliedUserConfigFields.value
      expect(Object.keys(scopeFields)).toEqual(['label', 'remarks', 'collectors'])
    })

    test('asks before discarding unapplied edits and keeps them when declined', async () => {
      const { secondary, confirmAction } = await setup({ confirmed: false })
      const section = secondary.sections.value[0]
      const store = useUserConfigStore(section.scope)
      store.setFieldType('remarks', 'normal')
      expect(store.hasUnappliedUserConfigChanges.value).toBe(true)
      globalThis.fetch = vi.fn(async () => json({ data: changedRecord }))

      const result = await secondary.reloadCollectionConfig(section)

      expect(result).toEqual({ ok: false, cancelled: true })
      expect(confirmAction).toHaveBeenCalledWith('Discard the unapplied changes and load the configuration from Strapi?')
      expect(globalThis.fetch).not.toHaveBeenCalled()
      expect(store.hasUnappliedUserConfigChanges.value).toBe(true)
    })
  })

  test('unlinking removes only the link to the selected item and drops the item from the list', async () => {
    const { secondary, selectedItem, confirmAction } = await setup()
    selectedItem.value = cardItem('card-1')
    await flush()
    const section = secondary.sections.value[0]

    const done = await secondary.unlinkItem(section, section.items[0])

    expect(done).toBe(true)
    expect(confirmAction.mock.calls[0][0]).toContain('item_1')
    expect(lastRequest()).toEqual({
      url: 'https://cms.example.org/api/collection-items/ci-1',
      method: 'PUT',
      body: { data: { index_cards: { disconnect: [{ documentId: 'card-1' }] } } },
    })
    expect(section.items.map((item) => item.label)).toEqual(['item_2'])
  })

  test('deleting sends DELETE, discards unsaved edits and drops the item', async () => {
    const { secondary, selectedItem, confirmAction } = await setup()
    selectedItem.value = cardItem('card-1')
    await flush()
    const section = secondary.sections.value[0]
    const item = section.items[1]
    secondary.changeField(item, 'remarks', 'edited', 'text')

    const done = await secondary.deleteItem(section, item)

    expect(done).toBe(true)
    expect(confirmAction.mock.calls[0][0]).toContain('unsaved changes')
    expect(lastRequest()).toMatchObject({ url: 'https://cms.example.org/api/collection-items/ci-2', method: 'DELETE' })
    expect(section.items.map((entry) => entry.label)).toEqual(['item_1'])
    expect(useOnlineUpdatesStore().pendingUpdateCount.value).toBe(0)
  })

  test('nothing is sent when the confirmation is declined', async () => {
    const { secondary, selectedItem } = await setup({ confirmed: false })
    selectedItem.value = cardItem('card-1')
    await flush()
    const section = secondary.sections.value[0]
    const callsBefore = globalThis.fetch.mock.calls.length

    expect(await secondary.deleteItem(section, section.items[0])).toBe(false)
    expect(globalThis.fetch.mock.calls.length).toBe(callsBefore)
    expect(section.items).toHaveLength(2)
  })

  test('a failed request keeps the item and shows the error', async () => {
    const { secondary, selectedItem } = await setup()
    selectedItem.value = cardItem('card-1')
    await flush()
    const section = secondary.sections.value[0]
    globalThis.fetch = vi.fn(async () => ({ ok: false, status: 403, json: async () => ({ error: { message: 'Forbidden' } }) }))

    expect(await secondary.deleteItem(section, section.items[0])).toBe(false)
    expect(section.items).toHaveLength(2)
    expect(section.actionError).toBe('Forbidden')
    expect(secondary.busyKey.value).toBe('')
  })

  test('the own Save of an item saves that item', async () => {
    const { secondary, selectedItem, saveItem } = await setup()
    selectedItem.value = cardItem('card-1')
    await flush()
    const item = secondary.sections.value[0].items[0]
    await secondary.saveLinkedItem(item)
    expect(saveItem).toHaveBeenCalledWith(item)
    expect(secondary.savingKey.value).toBe('')
  })
})
