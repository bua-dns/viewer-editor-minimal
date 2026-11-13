import { ref } from 'vue'
import { beforeEach, describe, expect, test, vi } from 'vitest'

const state = {
  appMode: ref('online'),
  isAuthenticated: ref(true),
  token: ref('t'),
  connectionProfile: ref({ baseUrl: 'https://x', configPath: '/api/viewer-setting' }),
  hasPendingUpdates: ref(false),
  hasReplacementsChanges: ref(false),
  hasPendingOnlineChanges: ref(false),
  saveOnlineUpdates: vi.fn(),
  persistOnlineReplacements: vi.fn(),
  markReplacementsAsSaved: vi.fn(),
}

vi.mock('../stores/useOnlineModeStore', () => ({ useOnlineModeStore: () => ({ appMode: state.appMode }) }))
vi.mock('../stores/useAuthStore', () => ({
  useAuthStore: () => ({ isAuthenticated: state.isAuthenticated, token: state.token }),
}))
vi.mock('../stores/useConnectionProfileStore', () => ({
  useConnectionProfileStore: () => ({ connectionProfile: state.connectionProfile }),
}))
vi.mock('../stores/useOnlineSettingsStore', () => ({
  useOnlineSettingsStore: () => ({ persistOnlineReplacements: state.persistOnlineReplacements }),
}))
vi.mock('../stores/useOnlineUpdatesStore', () => ({
  useOnlineUpdatesStore: () => ({ hasPendingUpdates: state.hasPendingUpdates, saveOnlineUpdates: state.saveOnlineUpdates }),
}))
vi.mock('../stores/useReplacementsStore', () => ({
  useReplacementsStore: () => ({
    hasReplacementsChanges: state.hasReplacementsChanges,
    createReplacementsPayload: () => ({ allFields: { a: 'b' } }),
    markReplacementsAsSaved: state.markReplacementsAsSaved,
  }),
}))
vi.mock('./usePendingOnlineChangesGuard', () => ({
  usePendingOnlineChangesGuard: () => ({ hasPendingOnlineChanges: state.hasPendingOnlineChanges }),
}))

const { useOnlineSave } = await import('./useOnlineSave')

function setup() {
  const createdItem = { label: 'new' }
  const viewerData = {
    rawItems: ref([{ label: 'old' }, createdItem]),
    importFileName: ref('online:/api/index-cards'),
    markAsSaved: vi.fn(),
    syncSnapshotItemAtIndex: vi.fn(),
  }
  return { ...useOnlineSave(viewerData), viewerData, createdItem }
}

function pending({ updates = false, rules = false } = {}) {
  state.hasPendingUpdates.value = updates
  state.hasReplacementsChanges.value = rules
  state.hasPendingOnlineChanges.value = updates || rules
}

describe('useOnlineSave', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    state.appMode.value = 'online'
    state.isAuthenticated.value = true
    pending()
    state.saveOnlineUpdates.mockResolvedValue({ ok: true })
    state.persistOnlineReplacements.mockResolvedValue({ ok: true })
  })

  test('does nothing and reports false without a signed-in online session', async () => {
    pending({ updates: true })
    state.isAuthenticated.value = false
    await expect(setup().saveOnlineChanges()).resolves.toBe(false)
    expect(state.saveOnlineUpdates).not.toHaveBeenCalled()
  })

  test('with nothing pending there is nothing to save', async () => {
    await expect(setup().saveOnlineChanges()).resolves.toBe(true)
    expect(state.saveOnlineUpdates).not.toHaveBeenCalled()
  })

  test('saves item changes and changed rules and marks the data as saved', async () => {
    pending({ updates: true, rules: true })
    const { saveOnlineChanges, viewerData } = setup()

    await expect(saveOnlineChanges()).resolves.toBe(true)
    expect(state.saveOnlineUpdates).toHaveBeenCalledWith({ profile: state.connectionProfile.value, token: 't' })
    expect(state.persistOnlineReplacements).toHaveBeenCalledWith({ allFields: { a: 'b' } })
    expect(state.markReplacementsAsSaved).toHaveBeenCalled()
    expect(viewerData.markAsSaved).toHaveBeenCalledWith('online:/api/index-cards')
  })

  test('only changed rules: saves just the rules', async () => {
    pending({ rules: true })
    await expect(setup().saveOnlineChanges()).resolves.toBe(true)
    expect(state.saveOnlineUpdates).not.toHaveBeenCalled()
    expect(state.persistOnlineReplacements).toHaveBeenCalled()
  })

  test('reports false when the rules could not be saved', async () => {
    pending({ updates: true, rules: true })
    state.persistOnlineReplacements.mockResolvedValue({ ok: false })
    await expect(setup().saveOnlineChanges()).resolves.toBe(false)
    expect(state.markReplacementsAsSaved).not.toHaveBeenCalled()
  })

  test('a partly failed save reports false and keeps the created items in sync', async () => {
    pending({ updates: true })
    const { saveOnlineChanges, viewerData, createdItem } = setup()
    state.saveOnlineUpdates.mockResolvedValue({ ok: false, createdItems: [createdItem] })

    await expect(saveOnlineChanges()).resolves.toBe(false)
    expect(viewerData.markAsSaved).not.toHaveBeenCalled()
    expect(viewerData.syncSnapshotItemAtIndex).toHaveBeenCalledWith(1)
  })

  test('a partly failed save re-baselines the updated items that were saved (plan 0.3)', async () => {
    pending({ updates: true })
    const { saveOnlineChanges, viewerData } = setup()
    const updatedItem = viewerData.rawItems.value[0]
    state.saveOnlineUpdates.mockResolvedValue({ ok: false, createdItems: [], updatedItems: [updatedItem] })

    await expect(saveOnlineChanges()).resolves.toBe(false)
    expect(viewerData.syncSnapshotItemAtIndex).toHaveBeenCalledTimes(1)
    expect(viewerData.syncSnapshotItemAtIndex).toHaveBeenCalledWith(0)
  })
})
