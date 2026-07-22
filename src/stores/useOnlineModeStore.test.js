import { beforeEach, describe, expect, test } from 'vitest'
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
  beforeEach(() => {
    globalThis.localStorage = createLocalStorageMock()
    const store = useOnlineModeStore()
    store.setAppMode('offline')
  })

  test('stores and restores app mode', () => {
    const store = useOnlineModeStore()
    store.setAppMode('online')
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
})
