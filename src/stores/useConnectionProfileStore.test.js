import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { useAppConfigStore } from './useAppConfigStore'
import { useConnectionProfileStore } from './useConnectionProfileStore'
import { createLocalStorageMock } from '../../test/helpers/storageMock.js'

// Stubs the two endpoints `testConnection` probes. `status` is returned for both.
function stubConnectionTest(status = 200) {
  const calls = []
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url, method: options.method || 'GET' })
    return { ok: status < 400, status }
  }
  return calls
}

describe('useConnectionProfileStore', () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    globalThis.localStorage = createLocalStorageMock()
    useAppConfigStore().applyBasicConfig({})
    const store = useConnectionProfileStore()
    store.clearConnectionProfile()
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    useAppConfigStore().applyBasicConfig({})
  })

  test('saves a profile that passes the connection test and reloads it', async () => {
    const store = useConnectionProfileStore()
    const calls = stubConnectionTest(200)

    const saved = await store.saveConnectionProfile({
      label: 'Migration',
      baseUrl: 'https://cms.example.org/project/',
      configPath: 'api/viewer-setting',
    })

    expect(saved.ok).toBe(true)
    expect(calls.map((call) => call.url)).toContain('https://cms.example.org/project/api/viewer-setting')
    expect(store.connectionProfile.value.baseUrl).toBe('https://cms.example.org/project')
    expect(store.connectionProfile.value.configPath).toBe('/api/viewer-setting')

    store.connectionProfile.value = null
    const loaded = store.initializeConnectionProfile()
    expect(loaded.ok).toBe(true)
    expect(loaded.source).toBe('storage')
    expect(store.connectionProfile.value.baseUrl).toBe('https://cms.example.org/project')
  })

  test('does not save a profile when the connection test fails', async () => {
    const store = useConnectionProfileStore()
    stubConnectionTest(404)

    const result = await store.saveConnectionProfile({
      baseUrl: 'https://cms.example.org/project',
      configPath: '/api/viewer-setting',
    })

    expect(result.ok).toBe(false)
    expect(result.reason).toBe('connection-test-failed')
    expect(store.connectionProfile.value).toBe(null)
    expect(globalThis.localStorage.getItem('viewerEditor.connectionProfile.v1')).toBe(null)
  })

  test('rejects an invalid profile without calling the backend', async () => {
    const store = useConnectionProfileStore()
    const calls = stubConnectionTest(200)

    const result = await store.saveConnectionProfile({ baseUrl: 'foo', configPath: '' })

    expect(result.ok).toBe(false)
    expect(result.errors.baseUrl).toBeTruthy()
    expect(result.errors.configPath).toBeTruthy()
    expect(calls).toHaveLength(0)
  })

  test('imports profile JSON', async () => {
    const store = useConnectionProfileStore()
    stubConnectionTest(200)

    const result = await store.importConnectionProfileFromJsonText(
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

  test('uses the profile shipped in the basic config over a stored one', () => {
    globalThis.localStorage.setItem(
      'viewerEditor.connectionProfile.v1',
      JSON.stringify({ version: 1, baseUrl: 'https://stored.example.org', configPath: '/api/viewer-setting' }),
    )
    useAppConfigStore().applyBasicConfig({
      connectionProfile: { baseUrl: 'https://shipped.example.org/', configPath: 'api/viewer-setting' },
    })
    const store = useConnectionProfileStore()

    const result = store.initializeConnectionProfile()

    expect(result.source).toBe('basic-config')
    expect(store.isProfileFixed.value).toBe(true)
    expect(store.connectionProfile.value.baseUrl).toBe('https://shipped.example.org')
    // The stored profile is ignored, not deleted.
    expect(globalThis.localStorage.getItem('viewerEditor.connectionProfile.v1')).toContain('stored.example.org')
  })

  test('refuses to save or clear a shipped profile', async () => {
    useAppConfigStore().applyBasicConfig({
      connectionProfile: { baseUrl: 'https://shipped.example.org', configPath: '/api/viewer-setting' },
    })
    const store = useConnectionProfileStore()
    store.initializeConnectionProfile()
    const calls = stubConnectionTest(200)

    const saved = await store.saveConnectionProfile({
      baseUrl: 'https://other.example.org',
      configPath: '/api/viewer-setting',
    })

    expect(saved.ok).toBe(false)
    expect(saved.reason).toBe('fixed')
    expect(calls).toHaveLength(0)
    expect(store.clearConnectionProfile()).toBe(false)
    expect(store.connectionProfile.value.baseUrl).toBe('https://shipped.example.org')
  })
})
