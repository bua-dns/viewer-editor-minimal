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

async function setup() {
  globalThis.fetch = vi.fn(async (url) => {
    if (String(url).includes('/api/collection-items')) return json({ data: linkedRows })
    return json({ data: record })
  })
  await useOnlineSettingsStore().fetchOnlineSettings()
  const selectedItem = ref(null)
  const saveItem = vi.fn(async () => true)
  const secondary = useSecondaryItems({ selectedItem, saveItem })
  secondary.initialize()
  return { secondary, selectedItem, saveItem }
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
