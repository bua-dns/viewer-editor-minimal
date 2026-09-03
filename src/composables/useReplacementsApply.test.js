import { beforeEach, describe, expect, test, vi } from 'vitest'
import { computed, ref } from 'vue'
import { useReplacementsApply } from './useReplacementsApply'
import { useReplacementsStore } from '../stores/useReplacementsStore'
import { useViewerData } from './useViewerData'

function createHarness({ online = false, remoteResult = { ok: true } } = {}) {
  const model = useViewerData()
  model.initializeFromJsonArray([
    { place: 'Gruenberg i. Schl.', __onlineMeta: { id: 'doc-1', itemsPath: '/api/cards' } },
    { place: 'Berlin', __onlineMeta: { id: 'doc-2', itemsPath: '/api/cards' } },
  ])

  const trackOnlineFieldChange = vi.fn()
  const trackOnlineReplacementUpdatesForRemainingItems = vi.fn().mockResolvedValue(remoteResult)

  const { applyReplacementsNow } = useReplacementsApply({
    appMode: ref(online ? 'online' : 'offline'),
    isAuthenticated: ref(online),
    connectionProfile: ref(online ? { baseUrl: 'https://cms.example.org' } : null),
    token: ref('jwt-1'),
    onlineSettings: ref(online ? { itemsPath: '/api/cards' } : null),
    rawItems: model.rawItems,
    importSnapshot: model.importSnapshot,
    replacementFieldConfigs: computed(() => ({ place: { type: 'normal' } })),
    applyReplacementsToLoadedItems: model.applyReplacementsToLoadedItems,
    trackOnlineFieldChange,
    trackOnlineReplacementUpdatesForRemainingItems,
  })

  return { model, applyReplacementsNow, trackOnlineFieldChange, trackOnlineReplacementUpdatesForRemainingItems }
}

describe('useReplacementsApply', () => {
  beforeEach(() => {
    useReplacementsStore().clearReplacements()
  })

  test('offline run changes loaded items without touching the online pipeline', async () => {
    const store = useReplacementsStore()
    store.addReplacement('allFields', 'i. Schl.', 'in Schlesien')

    const harness = createHarness({ online: false })
    await harness.applyReplacementsNow()

    expect(harness.model.rawItems.value[0].place).toBe('Gruenberg in Schlesien')
    expect(harness.trackOnlineFieldChange).not.toHaveBeenCalled()
    expect(harness.trackOnlineReplacementUpdatesForRemainingItems).not.toHaveBeenCalled()
    expect(store.applyStatus.value).toBe('success')
    expect(store.lastApplySummary.value).toMatchObject({
      online: false,
      changedItemCount: 1,
      changedFieldCount: 1,
    })
  })

  test('online run tracks loaded deltas and extends to the rest of the collection', async () => {
    const store = useReplacementsStore()
    store.addReplacement('allFields', 'i. Schl.', 'in Schlesien')

    const harness = createHarness({
      online: true,
      remoteResult: { ok: true, scannedCount: 120, changedItemCount: 7, changedFieldCount: 9 },
    })
    await harness.applyReplacementsNow()

    expect(harness.trackOnlineFieldChange).toHaveBeenCalledTimes(1)
    expect(harness.trackOnlineFieldChange).toHaveBeenCalledWith(
      expect.objectContaining({ key: 'place', nextValue: 'Gruenberg in Schlesien' }),
    )

    const remoteCall = harness.trackOnlineReplacementUpdatesForRemainingItems.mock.calls[0][0]
    expect(remoteCall.loadedIds).toEqual(['doc-1', 'doc-2'])

    expect(store.lastApplySummary.value).toMatchObject({
      online: true,
      changedItemCount: 1,
      remoteScannedCount: 120,
      remoteChangedItemCount: 7,
      remoteChangedFieldCount: 9,
    })
  })

  test('reports an error when the collection pass fails', async () => {
    const store = useReplacementsStore()
    store.addReplacement('allFields', 'i. Schl.', 'in Schlesien')

    const harness = createHarness({ online: true, remoteResult: { ok: false, error: 'boom' } })
    const result = await harness.applyReplacementsNow()

    expect(result.ok).toBe(false)
    expect(store.applyStatus.value).toBe('error')
    expect(store.lastApplyError.value).toBe('boom')
  })

  test('does nothing without rules', async () => {
    const harness = createHarness({ online: true })
    await harness.applyReplacementsNow()

    expect(harness.model.rawItems.value[0].place).toBe('Gruenberg i. Schl.')
    expect(harness.trackOnlineReplacementUpdatesForRemainingItems).not.toHaveBeenCalled()
    expect(useReplacementsStore().applyStatus.value).toBe('success')
  })
})
