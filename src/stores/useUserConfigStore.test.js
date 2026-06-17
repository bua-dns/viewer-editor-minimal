import { beforeEach, describe, expect, test } from 'vitest'
import { useUserConfigStore } from './useUserConfigStore'

function createSessionStorageMock() {
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

describe('useUserConfigStore autosuggest gui config', () => {
  beforeEach(() => {
    globalThis.sessionStorage = createSessionStorageMock()
    const store = useUserConfigStore()
    store.userConfigFields.value = {}
    store.appliedUserConfigFields.value = {}
    store.clearUserConfigSession()
  })

  test('initializes minimal autosuggest config when switching type', () => {
    const store = useUserConfigStore()
    store.initializeUserConfig(['collector'], true)

    const updated = store.setFieldType('collector', 'wikidata-autosuggest')

    expect(updated).toBe(true)
    expect(store.userConfigFields.value.collector.type).toBe('wikidata-autosuggest')
    expect(store.userConfigFields.value.collector.autosuggest).toEqual({})
  })

  test('preserves unknown autosuggest keys during gui-style updates', () => {
    const store = useUserConfigStore()
    const imported = {
      fields: {
        collector: {
          type: 'wikidata-autosuggest',
          autosuggest: {
            futureOption: {
              foo: 'bar',
            },
            resultLanguage: 'de',
          },
        },
      },
    }

    const applyResult = store.applyImportedConfigPayload(imported)
    expect(applyResult.ok).toBe(true)

    const current = store.userConfigFields.value.collector.autosuggest
    const updated = store.updateFieldAutosuggestConfig('collector', {
      ...current,
      limit: 25,
    })

    expect(updated).toBe(true)

    const payload = store.createUserConfigPayload()
    expect(payload.fields.collector.autosuggest).toEqual({
      futureOption: {
        foo: 'bar',
      },
      resultLanguage: 'de',
      limit: 25,
    })
  })

  test('removes autosuggest when field type changes away', () => {
    const store = useUserConfigStore()
    store.initializeUserConfig(['collector'], true)
    store.setFieldType('collector', 'wikidata-autosuggest')
    store.updateFieldAutosuggestConfig('collector', { resultLanguage: 'de' })

    const switched = store.setFieldType('collector', 'normal')

    expect(switched).toBe(true)
    expect(store.userConfigFields.value.collector.type).toBe('normal')
    expect(store.userConfigFields.value.collector.autosuggest).toBeUndefined()
  })
})
