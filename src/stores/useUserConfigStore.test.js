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
    expect(store.userConfigFields.value.collector.autosuggest).toEqual({ minChars: 2, limit: 50 })
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
    expect(store.userConfigFields.value.collector.readOnly).toBe(false)
  })

  test('drops readOnly when switching to wikidata-autosuggest', () => {
    const store = useUserConfigStore()
    store.initializeUserConfig(['collector'], true)
    store.userConfigFields.value.collector.readOnly = true

    const switched = store.setFieldType('collector', 'wikidata-autosuggest')

    expect(switched).toBe(true)
    expect(store.userConfigFields.value.collector.readOnly).toBeUndefined()
  })

  test('persists configured item label field in payload', () => {
    const store = useUserConfigStore()
    store.initializeUserConfig(['inventory_number', 'species'], true)

    const updated = store.setItemLabelField('species')
    expect(updated).toBe(true)

    store.applyUserConfigToRawItems([{ inventory_number: 'A1', species: 'Oak' }])
    const payload = store.createUserConfigPayload()

    expect(payload.itemLabelField).toBe('species')
  })

  test('clears item label field when configured key is removed', () => {
    const store = useUserConfigStore()
    store.initializeUserConfig(['inventory_number', 'species'], true)
    store.setItemLabelField('species')

    store.removeUserConfigField('species')

    expect(store.itemLabelField.value).toBe('')
  })

  test('persists markAsEditedBasis in payload', () => {
    const store = useUserConfigStore()
    store.initializeUserConfig(['inventory_number', 'edited_note'], true)

    const updated = store.setMarkAsEditedBasis('edited_note')
    expect(updated).toBe(true)

    store.applyUserConfigToRawItems([{ inventory_number: 'A1', edited_note: '' }])
    const payload = store.createUserConfigPayload()

    expect(payload.markAsEditedBasis).toBe('edited_note')
  })

  test('clears markAsEditedBasis when configured key is removed', () => {
    const store = useUserConfigStore()
    store.initializeUserConfig(['inventory_number', 'edited_note'], true)
    store.setMarkAsEditedBasis('edited_note')

    store.removeUserConfigField('edited_note')

    expect(store.markAsEditedBasis.value).toBe('')
  })

  test('persists showOnlyNonEmptyFields in payload', () => {
    const store = useUserConfigStore()
    store.initializeUserConfig(['inventory_number'], true)

    store.setShowOnlyNonEmptyFields(true)

    const payload = store.createUserConfigPayload()
    expect(payload.showOnlyNonEmptyFields).toBe(true)
  })

  test('keeps hint in payload for normal fields', () => {
    const store = useUserConfigStore()
    store.initializeUserConfig(['species'], true)
    store.userConfigFields.value.species.hint = 'Use latin species name'

    const payload = store.createUserConfigPayload()

    expect(payload.fields.species.hint).toBe('Use latin species name')
  })
})
