import { beforeEach, describe, expect, test } from 'vitest'
import { useConnectionProfileStore } from './useConnectionProfileStore'

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
    clear() {
      store.clear()
    },
  }
}

describe('useConnectionProfileStore', () => {
  beforeEach(() => {
    globalThis.localStorage = createLocalStorageMock()
    const store = useConnectionProfileStore()
    store.clearConnectionProfile()
  })

  test('saves and reloads a connection profile', () => {
    const store = useConnectionProfileStore()

    const saved = store.saveConnectionProfile({
      label: 'Migration',
      baseUrl: 'https://cms.example.org/project/',
      configPath: 'api/viewer-setting',
    })

    expect(saved.ok).toBe(true)
    expect(store.connectionProfile.value.baseUrl).toBe('https://cms.example.org/project')
    expect(store.connectionProfile.value.configPath).toBe('/api/viewer-setting')

    store.connectionProfile.value = null
    const loaded = store.loadConnectionProfileFromStorage()
    expect(loaded.ok).toBe(true)
    expect(store.connectionProfile.value.baseUrl).toBe('https://cms.example.org/project')
  })

  test('rejects invalid profile on save', () => {
    const store = useConnectionProfileStore()
    const result = store.saveConnectionProfile({ baseUrl: 'foo', configPath: '' })

    expect(result.ok).toBe(false)
    expect(result.errors.baseUrl).toBeTruthy()
    expect(result.errors.configPath).toBeTruthy()
  })

  test('imports profile JSON', () => {
    const store = useConnectionProfileStore()
    const result = store.importConnectionProfileFromJsonText(
      JSON.stringify({
        version: 1,
        label: 'Import',
        baseUrl: 'https://example.org/base',
        configPath: '/api/viewer-setting',
      }),
    )

    expect(result.ok).toBe(true)
    expect(store.connectionProfile.value.label).toBe('Import')
  })
})
