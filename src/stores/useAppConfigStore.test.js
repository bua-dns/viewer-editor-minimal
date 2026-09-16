import { readFileSync } from 'node:fs'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { useAppConfigStore } from './useAppConfigStore'

const shippedWording = JSON.parse(
  readFileSync(new URL('../../public/app-config/wording.json', import.meta.url), 'utf8'),
)

describe('useAppConfigStore wording merge', () => {
  beforeEach(() => {
    const store = useAppConfigStore()
    store.setLocalWording(shippedWording)
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

  test('uses the inline fallback when no wording is loaded', () => {
    const store = useAppConfigStore()
    store.setLocalWording({})
    expect(store.t('appTitle', 'Fallback title')).toBe('Fallback title')
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

describe('useAppConfigStore basic config', () => {
  const originalFetch = globalThis.fetch
  const originalLocalStorage = globalThis.localStorage

  const basicConfigPayload = {
    version: 1,
    connectionMode: 'offline',
    connectionProfile: {
      label: 'Shipped',
      baseUrl: 'https://cms.example.org/base/',
      configPath: 'api/viewer-setting',
    },
    language: 'en',
    languageMode: 'single',
    primaryColor: '#123456',
    dataInspectionMode: true,
  }

  function stubPublicFiles({ config = basicConfigPayload, wording = { appTitle: { de: 'Titel', en: 'Title' } } } = {}) {
    const calls = []
    globalThis.fetch = async (url) => {
      calls.push(url)
      if (config !== null && url === '/viewer-editor/app-config/viewer-editor-app-config.v1.json') {
        return { ok: true, text: async () => (typeof config === 'string' ? config : JSON.stringify(config)) }
      }
      if (wording !== null && url === '/viewer-editor/app-config/wording.json') {
        return { ok: true, text: async () => JSON.stringify(wording) }
      }
      return { ok: false, status: 404 }
    }
    return calls
  }

  beforeEach(() => {
    globalThis.localStorage = createLocalStorageMock()
    Object.defineProperty(globalThis, 'location', {
      value: { pathname: '/viewer-editor/index.html' },
      configurable: true,
    })
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    // Module-global state: reset to the defaults so a loaded file does not leak into other tests.
    useAppConfigStore().applyBasicConfig({})
    useAppConfigStore().setLocalWording(shippedWording)
    globalThis.localStorage = originalLocalStorage
  })

  test('uses the hard-coded defaults before anything is loaded', () => {
    const store = useAppConfigStore()
    store.applyBasicConfig({})

    expect(store.connectionMode.value).toBe('switchable')
    expect(store.basicConnectionProfile.value).toBe(null)
    expect(store.language.value).toBe('de')
    expect(store.languageMode.value).toBe('multi')
    expect(store.showLanguageSwitch.value).toBe(true)
    expect(store.primaryColor.value).toBe('#0066CC')
    expect(store.dataInspectionMode.value).toBe(false)
  })

  test('loads the basic config and the wording from the app-config folder', async () => {
    const store = useAppConfigStore()
    const calls = stubPublicFiles()

    const result = await store.loadBasicConfig()

    expect(result.ok).toBe(true)
    expect(calls).toContain('/viewer-editor/app-config/viewer-editor-app-config.v1.json')
    expect(calls).toContain('/viewer-editor/app-config/wording.json')
    expect(store.basicConfigSource.value).toBe('file')
    expect(store.connectionMode.value).toBe('offline')
    expect(store.language.value).toBe('en')
    expect(store.languageMode.value).toBe('single')
    expect(store.primaryColor.value).toBe('#123456')
    expect(store.dataInspectionMode.value).toBe(true)
    expect(store.t('appTitle', '')).toBe('Title')
  })

  test('normalizes a shipped connection profile', async () => {
    const store = useAppConfigStore()
    stubPublicFiles()

    await store.loadBasicConfig()

    expect(store.basicConnectionProfile.value.baseUrl).toBe('https://cms.example.org/base')
    expect(store.basicConnectionProfile.value.configPath).toBe('/api/viewer-setting')
  })

  test('ignores an invalid shipped connection profile', async () => {
    const store = useAppConfigStore()
    stubPublicFiles({ config: { ...basicConfigPayload, connectionProfile: { baseUrl: 'not a url' } } })

    await store.loadBasicConfig()

    expect(store.basicConnectionProfile.value).toBe(null)
  })

  test('keeps the defaults when the basic config file is missing', async () => {
    const store = useAppConfigStore()
    stubPublicFiles({ config: null })

    const result = await store.loadBasicConfig()

    expect(result.ok).toBe(false)
    expect(result.config.reason).toBe('fetch-failed')
    expect(store.basicConfigSource.value).toBe('defaults')
    expect(store.primaryColor.value).toBe('#0066CC')
    expect(store.t('appTitle', '')).toBe('Titel')
  })

  test('keeps the defaults when the basic config file is not valid JSON', async () => {
    const store = useAppConfigStore()
    stubPublicFiles({ config: 'not json' })

    const result = await store.loadBasicConfig()

    expect(result.config.reason).toBe('invalid-json')
    expect(store.connectionMode.value).toBe('switchable')
  })

  test('falls back to inline texts when the wording file is missing', async () => {
    const store = useAppConfigStore()
    stubPublicFiles({ wording: null })

    await store.loadBasicConfig()

    expect(store.t('appTitle', 'Inline')).toBe('Inline')
  })

  test('removes the old app settings snapshot from localStorage', async () => {
    const store = useAppConfigStore()
    globalThis.localStorage.setItem('viewerEditor.appConfig.v1', '{"primaryColor":"#abcdef"}')
    stubPublicFiles()

    await store.loadBasicConfig()

    expect(globalThis.localStorage.getItem('viewerEditor.appConfig.v1')).toBe(null)
    expect(store.primaryColor.value).toBe('#123456')
  })
})
