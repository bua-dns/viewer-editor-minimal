import { beforeEach, describe, expect, test } from 'vitest'
import { useUserConfigStore } from './useUserConfigStore'

// Field config starts empty; the tests add fields the way the Konfiguration tab does.
function initializeWithDataKeys(store, dataKeys) {
  store.initializeUserConfig()
  store.addUserConfigFieldsFromDataKeys(dataKeys)
}

describe('useUserConfigStore autosuggest gui config', () => {
  beforeEach(() => {
    useUserConfigStore().initializeUserConfig()
  })

  test('initializes minimal autosuggest config when switching type', () => {
    const store = useUserConfigStore()
    initializeWithDataKeys(store, ['collector'])

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
    initializeWithDataKeys(store, ['collector'])
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
    initializeWithDataKeys(store, ['collector'])
    store.userConfigFields.value.collector.readOnly = true

    const switched = store.setFieldType('collector', 'wikidata-autosuggest')

    expect(switched).toBe(true)
    expect(store.userConfigFields.value.collector.readOnly).toBeUndefined()
  })

  test('initializes minimal candidate config when switching type', () => {
    const store = useUserConfigStore()
    initializeWithDataKeys(store, ['title_candidate'])

    const updated = store.setFieldType('title_candidate', 'candidate')

    expect(updated).toBe(true)
    expect(store.userConfigFields.value.title_candidate.type).toBe('candidate')
    expect(store.userConfigFields.value.title_candidate.candidate).toEqual({
      targetField: '',
      inputType: 'normal',
    })
  })

  test('updates candidate config with valid target and input mode', () => {
    const store = useUserConfigStore()
    initializeWithDataKeys(store, ['title', 'title_candidate'])
    store.setFieldType('title_candidate', 'candidate')

    const updated = store.updateFieldCandidateConfig('title_candidate', {
      targetField: 'title',
      inputType: 'text',
    })

    expect(updated).toBe(true)
    expect(store.userConfigFields.value.title_candidate.candidate).toEqual({
      targetField: 'title',
      inputType: 'text',
    })
  })

  test('rejects candidate config when target points to candidate field', () => {
    const store = useUserConfigStore()
    initializeWithDataKeys(store, ['title', 'first_candidate', 'second_candidate'])
    store.setFieldType('first_candidate', 'candidate')
    store.setFieldType('second_candidate', 'candidate')
    store.updateFieldCandidateConfig('first_candidate', {
      targetField: 'title',
      inputType: 'normal',
    })

    const updated = store.updateFieldCandidateConfig('second_candidate', {
      targetField: 'first_candidate',
      inputType: 'normal',
    })

    expect(updated).toBe(false)
  })

  test('persists configured item label field in payload', () => {
    const store = useUserConfigStore()
    initializeWithDataKeys(store, ['inventory_number', 'species'])

    const updated = store.setItemLabelField('species')
    expect(updated).toBe(true)

    store.applyUserConfigToRawItems([{ inventory_number: 'A1', species: 'Oak' }])
    const payload = store.createUserConfigPayload()

    expect(payload.itemLabelField).toBe('species')
  })

  test('clears item label field when configured key is removed', () => {
    const store = useUserConfigStore()
    initializeWithDataKeys(store, ['inventory_number', 'species'])
    store.setItemLabelField('species')

    store.removeUserConfigField('species')

    expect(store.itemLabelField.value).toBe('')
  })

  test('persists markAsEditedBasis in payload', () => {
    const store = useUserConfigStore()
    initializeWithDataKeys(store, ['inventory_number', 'edited_note'])

    const updated = store.setMarkAsEditedBasis('edited_note')
    expect(updated).toBe(true)

    store.applyUserConfigToRawItems([{ inventory_number: 'A1', edited_note: '' }])
    const payload = store.createUserConfigPayload()

    expect(payload.markAsEditedBasis).toBe('edited_note')
  })

  test('clears markAsEditedBasis when configured key is removed', () => {
    const store = useUserConfigStore()
    initializeWithDataKeys(store, ['inventory_number', 'edited_note'])
    store.setMarkAsEditedBasis('edited_note')

    store.removeUserConfigField('edited_note')

    expect(store.markAsEditedBasis.value).toBe('')
  })

  test('persists showOnlyNonEmptyFields in payload', () => {
    const store = useUserConfigStore()
    initializeWithDataKeys(store, ['inventory_number'])

    store.setShowOnlyNonEmptyFields(true)

    const payload = store.createUserConfigPayload()
    expect(payload.showOnlyNonEmptyFields).toBe(true)
  })

  test('persists hierarchy fields and first level static list in payload', () => {
    const store = useUserConfigStore()
    initializeWithDataKeys(store, ['inventory_number'])

    store.addHierarchyField()
    store.updateHierarchyFieldAt(0, ' level_1 ')
    store.addHierarchyField()
    store.updateHierarchyFieldAt(1, 'level_2')
    store.setFirstLevelStaticListFromText('001\n002\n001\n')

    const payload = store.createUserConfigPayload()
    expect(payload.hierarchyFields).toEqual(['level_1', 'level_2'])
    expect(payload.firstLevelStaticList).toEqual(['001', '002'])
  })

  test('imports hierarchy fields and first level static list from config payload', () => {
    const store = useUserConfigStore()
    const imported = {
      fields: {
        label: { type: 'normal' },
      },
      hierarchyFields: [' level_1 ', 'level_2'],
      firstLevelStaticList: ['001', '002', '001', ''],
    }

    const result = store.applyImportedConfigPayload(imported)

    expect(result.ok).toBe(true)
    expect(store.hierarchyFields.value).toEqual(['level_1', 'level_2'])
    expect(store.firstLevelStaticList.value).toEqual(['001', '002'])
  })

  test('keeps hint in payload for normal fields', () => {
    const store = useUserConfigStore()
    initializeWithDataKeys(store, ['species'])
    store.userConfigFields.value.species.hint = 'Use latin species name'
    store.userConfigFields.value.species.fieldWidth = '50%'

    const payload = store.createUserConfigPayload()

    expect(payload.fields.species.hint).toBe('Use latin species name')
    expect(payload.fields.species.fieldWidth).toBe('50%')
  })

  test('initializes fieldWidth with 100% by default', () => {
    const store = useUserConfigStore()
    initializeWithDataKeys(store, ['species'])

    expect(store.userConfigFields.value.species.fieldWidth).toBe('100%')
  })

  test('starts without fields, whatever keys the data has', () => {
    const store = useUserConfigStore()
    initializeWithDataKeys(store, ['species'])

    store.initializeUserConfig()

    expect(store.userConfigFields.value).toEqual({})
    expect(store.appliedUserConfigFields.value).toEqual({})
    expect(store.hasUnappliedUserConfigChanges.value).toBe(false)
  })

  test('adding data keys skips keys that are already configured', () => {
    const store = useUserConfigStore()
    initializeWithDataKeys(store, ['species'])
    store.userConfigFields.value.species.type = 'text'

    const added = store.addUserConfigFieldsFromDataKeys(['species', 'collector'])

    expect(added).toEqual(['collector'])
    expect(store.userConfigFields.value.species.type).toBe('text')
    expect(store.userConfigFields.value.collector.type).toBe('normal')
    expect(store.userConfigFields.value.collector.order).toBe(1)
    expect(store.hasUnappliedUserConfigChanges.value).toBe(true)
  })

  test('does not include suspendEditing when adding data keys', () => {
    const store = useUserConfigStore()
    initializeWithDataKeys(store, ['inventory_number', 'suspendEditing'])

    expect(Object.keys(store.userConfigFields.value)).toEqual(['inventory_number'])
  })

  test('does not include __onlineMeta when adding data keys', () => {
    const store = useUserConfigStore()
    initializeWithDataKeys(store, ['inventory_number', '__onlineMeta'])

    expect(Object.keys(store.userConfigFields.value)).toEqual(['inventory_number'])
  })

  test('filters suspendEditing from imported config payload', () => {
    const store = useUserConfigStore()
    const imported = {
      fields: {
        inventory_number: { type: 'normal' },
        suspendEditing: { type: 'checkbox' },
      },
      itemLabelField: 'suspendEditing',
    }

    const result = store.applyImportedConfigPayload(imported)

    expect(result.ok).toBe(true)
    expect(Object.keys(store.userConfigFields.value)).toEqual(['inventory_number'])
    expect(store.itemLabelField.value).toBe('')
  })
})
