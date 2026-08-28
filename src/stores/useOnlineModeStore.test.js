import { beforeEach, describe, expect, test } from 'vitest'
import appConfig from '../../config/app.config'
import { useOnlineModeStore } from './useOnlineModeStore'

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

describe('useOnlineModeStore', () => {
  const configuredMode = appConfig.connectionMode
  const isSwitchable = configuredMode !== 'offline' && configuredMode !== 'online'
  const fixedMode = configuredMode === 'offline' || configuredMode === 'online' ? configuredMode : null

  beforeEach(() => {
    globalThis.localStorage = createLocalStorageMock()
    if (isSwitchable) {
      const store = useOnlineModeStore()
      store.setAppMode('offline')
    }
  })

  test('stores and restores app mode', () => {
    const store = useOnlineModeStore()
    if (isSwitchable) {
      store.setAppMode('online')
      expect(store.appMode.value).toBe('online')

      store.appMode.value = 'offline'
      store.loadAppModeFromStorage()
      expect(store.appMode.value).toBe('online')
      return
    }

    expect(store.appMode.value).toBe(fixedMode)
    globalThis.localStorage.setItem('viewerEditor.appMode.v1', fixedMode === 'online' ? 'offline' : 'online')
    store.loadAppModeFromStorage()
    expect(store.appMode.value).toBe(fixedMode)
  })

  test('rejects invalid app mode', () => {
    const store = useOnlineModeStore()
    const changed = store.setAppMode('foo')
    expect(changed).toBe(false)
    expect(store.appMode.value).toBe(fixedMode || 'offline')
  })

  test('disables mode switching for fixed connection mode', () => {
    const store = useOnlineModeStore()

    if (isSwitchable) {
      expect(store.isConnectionModeSwitchable.value).toBe(true)
      return
    }

    expect(store.isConnectionModeSwitchable.value).toBe(false)
    const oppositeMode = fixedMode === 'online' ? 'offline' : 'online'
    const changed = store.setAppMode(oppositeMode)
    expect(changed).toBe(false)
    expect(store.appMode.value).toBe(fixedMode)
  })
})
