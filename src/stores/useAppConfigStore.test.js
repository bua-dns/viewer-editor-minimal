import { beforeEach, describe, expect, test } from 'vitest'
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
})
