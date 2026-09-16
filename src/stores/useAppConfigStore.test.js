import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { useAppConfigStore } from './useAppConfigStore'

describe('useAppConfigStore wording merge', () => {
  beforeEach(() => {
    const store = useAppConfigStore()
    store.setLanguage('de')
    store.clearOnlineWording()
  })

  test('uses local wording by default', () => {
    const store = useAppConfigStore()
    store.setLanguage('en')
    expect(store.t('appTitle', '')).toBe('Viewer Editor for Finding Aids')
  })

  test('overrides local wording with backend values per language', () => {
    const store = useAppConfigStore()

    store.setOnlineWording({
      appTitle: {
        de: 'Online Titel',
      },
    })

    store.setLanguage('de')
    expect(store.t('appTitle', '')).toBe('Online Titel')

    store.setLanguage('en')
    expect(store.t('appTitle', '')).toBe('Viewer Editor for Finding Aids')
  })

  test('accepts backend-only wording keys', () => {
    const store = useAppConfigStore()

    store.setOnlineWording({
      onlineOnlyKey: {
        de: 'Nur online',
        en: 'Online only',
      },
    })

    store.setLanguage('de')
    expect(store.t('onlineOnlyKey', '')).toBe('Nur online')
  })

  test('falls back to local wording after clearing backend wording', () => {
    const store = useAppConfigStore()
    store.setLanguage('en')

    store.setOnlineWording({
      appTitle: {
        en: 'Online title',
      },
    })
    expect(store.t('appTitle', '')).toBe('Online title')

    store.clearOnlineWording()
    expect(store.t('appTitle', '')).toBe('Viewer Editor for Finding Aids')
  })

  test('keeps local settings tab wording even with backend wording override', () => {
    const store = useAppConfigStore()

    store.setOnlineWording({
      tabDatabaseConnection: {
        de: 'Datenbankanbindung',
        en: 'Database link',
      },
    })

    store.setLanguage('de')
    expect(store.t('tabDatabaseConnection', '')).toBe('Einstellungen')
  })
})

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

describe('useAppConfigStore default app config', () => {
  const originalFetch = globalThis.fetch
  const originalLocalStorage = globalThis.localStorage

  const defaultFilePayload = {
    version: 1,
    language: 'en',
    languageMode: 'multi',
    githubRepo: 'https://github.com/example/from-file',
    primaryColor: '#123456',
    connectionMode: 'offline',
    dataInspectionMode: true,
    defaultConnectionProfile: 'from-file-profile.v1.json',
  }

  function stubFetch(matcher, payload) {
    const calls = []
    globalThis.fetch = async (url) => {
      calls.push(url)
      if (matcher(url)) {
        return { ok: true, text: async () => JSON.stringify(payload) }
      }
      return { ok: false, status: 404 }
    }
    return calls
  }

  beforeEach(() => {
    globalThis.localStorage = createLocalStorageMock()
    const store = useAppConfigStore()
    store.clearEditableAppConfig()
    Object.defineProperty(globalThis, 'location', {
      value: { pathname: '/viewer-editor/index.html' },
      configurable: true,
    })
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    globalThis.localStorage = createLocalStorageMock()
    // Basisebene auf die Build-Defaults zuruecksetzen, damit ein geladener
    // Default-File-Snapshot nicht in andere Tests leckt (Modul-globaler State).
    useAppConfigStore().loadEditableAppConfigFromDefault('')
    useAppConfigStore().clearEditableAppConfig()
    globalThis.localStorage = originalLocalStorage
  })

  test('looks the file up under the app-config folder of the runtime path prefix', async () => {
    const store = useAppConfigStore()
    const calls = stubFetch(
      (url) => url === '/viewer-editor/app-config/viewer-editor-app-config.v1.json',
      defaultFilePayload,
    )

    const result = await store.loadEditableAppConfigFromDefault('viewer-editor-app-config.v1.json')

    expect(result.ok).toBe(true)
    expect(calls).toContain('/viewer-editor/app-config/viewer-editor-app-config.v1.json')
    expect(store.appConfigSource.value).toBe('default')
  })

  test('applies the default file over the build defaults', async () => {
    const store = useAppConfigStore()
    stubFetch(() => true, defaultFilePayload)

    await store.loadEditableAppConfigFromDefault('viewer-editor-app-config.v1.json')

    expect(store.primaryColor.value).toBe('#123456')
    expect(store.connectionMode.value).toBe('offline')
    expect(store.dataInspectionMode.value).toBe(true)
    expect(store.defaultConnectionProfile.value).toBe('from-file-profile.v1.json')
    expect(store.language.value).toBe('en')
    // Kein gespeicherter Snapshot: die Basis gilt, zaehlt aber nicht als "gespeichert".
    expect(store.hasSavedEditableAppConfig.value).toBe(false)
  })

  test('keeps a locally saved config in front of the default file', async () => {
    const store = useAppConfigStore()
    store.saveEditableAppConfig({ ...defaultFilePayload, primaryColor: '#abcdef' })

    stubFetch(() => true, defaultFilePayload)
    const result = await store.loadEditableAppConfigFromDefault('viewer-editor-app-config.v1.json')

    expect(result.ok).toBe(true)
    expect(result.overriddenByStorage).toBe(true)
    expect(store.primaryColor.value).toBe('#abcdef')
  })

  test('clearing the saved config falls back to the default file, not to app.config.js', async () => {
    const store = useAppConfigStore()
    stubFetch(() => true, defaultFilePayload)
    await store.loadEditableAppConfigFromDefault('viewer-editor-app-config.v1.json')

    store.saveEditableAppConfig({ ...defaultFilePayload, primaryColor: '#abcdef' })
    expect(store.primaryColor.value).toBe('#abcdef')

    store.clearEditableAppConfig()
    expect(store.primaryColor.value).toBe('#123456')
  })

  test('keeps the build defaults when the file is missing', async () => {
    const store = useAppConfigStore()
    const buildPrimaryColor = store.primaryColor.value
    stubFetch(() => false, defaultFilePayload)

    const result = await store.loadEditableAppConfigFromDefault('viewer-editor-app-config.v1.json')

    expect(result.ok).toBe(false)
    expect(result.reason).toBe('fetch-failed')
    expect(store.primaryColor.value).toBe(buildPrimaryColor)
    expect(store.appConfigSource.value).toBe('build')
  })

  test('keeps the build defaults when the file is not valid JSON', async () => {
    const store = useAppConfigStore()
    const buildPrimaryColor = store.primaryColor.value
    globalThis.fetch = async () => ({ ok: true, text: async () => 'not json' })

    const result = await store.loadEditableAppConfigFromDefault('viewer-editor-app-config.v1.json')

    expect(result.ok).toBe(false)
    expect(result.reason).toBe('invalid-json')
    expect(store.primaryColor.value).toBe(buildPrimaryColor)
  })

  test('skips the fetch when no default file is configured', async () => {
    const store = useAppConfigStore()
    let fetchCalled = false
    globalThis.fetch = async () => {
      fetchCalled = true
      return { ok: false, status: 404 }
    }

    const result = await store.loadEditableAppConfigFromDefault('')

    expect(result.ok).toBe(true)
    expect(result.hasDefault).toBe(false)
    expect(fetchCalled).toBe(false)
  })
})
