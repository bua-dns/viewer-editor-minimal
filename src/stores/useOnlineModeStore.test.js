import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { nextTick } from 'vue'
import { useAppConfigStore } from './useAppConfigStore'
import { useConnectionProfileStore } from './useConnectionProfileStore'
import { useOnlineModeStore } from './useOnlineModeStore'
import { createLocalStorageMock } from '../../test/helpers/storageMock.js'

const sampleProfile = {
  version: 1,
  baseUrl: 'https://cms.example.org/project',
  configPath: '/api/viewer-setting',
}

describe('useOnlineModeStore', () => {
  beforeEach(async () => {
    globalThis.localStorage = createLocalStorageMock()
    useAppConfigStore().applyBasicConfig({})
    await nextTick()
    useConnectionProfileStore().connectionProfile.value = null
    await nextTick()
    useOnlineModeStore().setAppMode('offline')
  })

  afterEach(async () => {
    useAppConfigStore().applyBasicConfig({})
    await nextTick()
  })

  test('stores and restores app mode when a profile exists', () => {
    const store = useOnlineModeStore()
    useConnectionProfileStore().connectionProfile.value = { ...sampleProfile }

    expect(store.setAppMode('online')).toBe(true)
    expect(store.appMode.value).toBe('online')

    store.appMode.value = 'offline'
    store.loadAppModeFromStorage()
    expect(store.appMode.value).toBe('online')
  })

  test('rejects invalid app mode', () => {
    const store = useOnlineModeStore()
    const changed = store.setAppMode('foo')
    expect(changed).toBe(false)
    expect(store.appMode.value).toBe('offline')
  })

  test('stays offline when online is chosen without a profile, and switches once one is saved', async () => {
    const store = useOnlineModeStore()

    expect(store.setAppMode('online')).toBe(false)
    expect(store.appMode.value).toBe('offline')
    expect(store.isOnlineSwitchPending.value).toBe(true)

    useConnectionProfileStore().connectionProfile.value = { ...sampleProfile }
    await nextTick()

    expect(store.appMode.value).toBe('online')
    expect(store.isOnlineSwitchPending.value).toBe(false)
  })

  test('restores a stored online mode as offline when no profile exists', () => {
    const store = useOnlineModeStore()
    globalThis.localStorage.setItem('viewerEditor.appMode.v1', 'online')

    store.loadAppModeFromStorage()

    expect(store.appMode.value).toBe('offline')
  })

  test('falls back to offline when the profile is removed while online', async () => {
    const store = useOnlineModeStore()
    useConnectionProfileStore().connectionProfile.value = { ...sampleProfile }
    await nextTick()
    store.setAppMode('online')

    useConnectionProfileStore().connectionProfile.value = null
    await nextTick()

    expect(store.appMode.value).toBe('offline')
  })

  test('disables mode switching for a fixed connection mode', async () => {
    useAppConfigStore().applyBasicConfig({ connectionMode: 'offline' })
    await nextTick()
    const store = useOnlineModeStore()
    useConnectionProfileStore().connectionProfile.value = { ...sampleProfile }

    expect(store.isConnectionModeSwitchable.value).toBe(false)
    expect(store.setAppMode('online')).toBe(false)
    expect(store.appMode.value).toBe('offline')
  })
})
