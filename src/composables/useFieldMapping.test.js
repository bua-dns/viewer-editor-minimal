import { beforeEach, describe, expect, test } from 'vitest'
import { useFieldMapping } from './useFieldMapping'
import { useUserConfigStore } from '../stores/useUserConfigStore'
import { markItemAsCreated } from './createdItems'

describe('useFieldMapping', () => {
  beforeEach(() => {
    const store = useUserConfigStore()
    store.appliedUserConfigFields.value = {
      title: {
        type: 'normal',
        order: 0,
      },
      subject: {
        type: 'wikidata-autosuggest',
        order: 1,
      },
      note: {
        type: 'normal',
        order: 2,
      },
      title_candidate: {
        type: 'candidate',
        order: 3,
        candidate: {
          targetField: 'title',
          inputType: 'text',
        },
      },
    }
    store.appliedShowOnlyNonEmptyFields.value = false
  })

  test('keeps empty wikidata autosuggest fields visible when filtering non-empty fields', () => {
    const store = useUserConfigStore()
    store.appliedShowOnlyNonEmptyFields.value = true

    const { getDisplayedFieldKeys } = useFieldMapping()
    const keys = getDisplayedFieldKeys({
      title: '',
      subject: [],
      note: 'ready',
      scan: 'ignore me',
    })

    expect(keys).toEqual(['subject', 'note'])
  })

  test('keeps empty fields of an item created in this session visible when filtering non-empty fields', () => {
    const store = useUserConfigStore()
    store.appliedShowOnlyNonEmptyFields.value = true
    const createdItem = { title: '', note: '' }
    markItemAsCreated(createdItem)

    const { getDisplayedFieldKeys } = useFieldMapping()

    expect(getDisplayedFieldKeys(createdItem)).toEqual(['title', 'note'])
    expect(getDisplayedFieldKeys({ title: '', note: '' })).toEqual([])
  })

  test('never shows suspendEditing as editable field key', () => {
    const { getDisplayedFieldKeys } = useFieldMapping()
    const keys = getDisplayedFieldKeys({
      title: 'A',
      suspendEditing: true,
      note: 'B',
    })

    expect(keys).toEqual(['title', 'note'])
  })

  test('hides fields configured as hidden but keeps them as autosuggest prefill source', () => {
    const store = useUserConfigStore()
    store.appliedUserConfigFields.value.note.hidden = true
    store.appliedUserConfigFields.value.subject.prefillWith = 'note'

    const { getDisplayedFieldKeys, getFieldEditorBinding } = useFieldMapping()
    const item = { title: 'A', subject: [], note: 'Berlin' }

    expect(getDisplayedFieldKeys(item)).toEqual(['title', 'subject'])
    expect(getFieldEditorBinding('subject', [], item).componentProps.prefillValue).toBe('Berlin')
  })

  test('proposes the prefill source value for an empty non-autosuggest field', () => {
    const store = useUserConfigStore()
    store.appliedUserConfigFields.value.title.prefillWith = 'note'
    const { getPrefillProposal } = useFieldMapping()

    expect(getPrefillProposal('title', { title: '', note: ' Berlin ' })).toBe('Berlin')
    expect(getPrefillProposal('title', { title: 'Paris', note: 'Berlin' })).toBe('')
    expect(getPrefillProposal('title', { title: '', note: 42 })).toBe('')
    expect(getPrefillProposal('note', { title: '', note: '' })).toBe('')
  })

  test('makes no proposal for checkbox and autosuggest fields', () => {
    const store = useUserConfigStore()
    store.appliedUserConfigFields.value.title = { type: 'checkbox', prefillWith: 'note' }
    store.appliedUserConfigFields.value.subject.prefillWith = 'note'
    const { getPrefillProposal } = useFieldMapping()
    const item = { title: false, subject: [], note: 'Berlin' }

    expect(getPrefillProposal('title', item)).toBe('')
    expect(getPrefillProposal('subject', item)).toBe('')
  })

  test('keeps an empty field with a prefill proposal visible when filtering non-empty fields', () => {
    const store = useUserConfigStore()
    store.appliedShowOnlyNonEmptyFields.value = true
    store.appliedUserConfigFields.value.title.prefillWith = 'note'
    const { getDisplayedFieldKeys } = useFieldMapping()

    expect(getDisplayedFieldKeys({ title: '', note: 'Berlin' })).toEqual(['title', 'note'])
  })

  test('never shows __onlineMeta as editable field key', () => {
    const { getDisplayedFieldKeys } = useFieldMapping()
    const keys = getDisplayedFieldKeys({
      title: 'A',
      __onlineMeta: { id: 'doc-1' },
      note: 'B',
    })

    expect(keys).toEqual(['title', 'note'])
  })

  test('passes candidate-triggered prefill to autosuggest editor binding', () => {
    const { getFieldEditorBinding } = useFieldMapping()
    const binding = getFieldEditorBinding(
      'subject',
      [],
      { title: 'Default prefill' },
      {
        subject: {
          value: 'Forced query',
          token: 3,
        },
      },
    )

    expect(binding.resolvedType).toBe('wikidata-autosuggest')
    expect(binding.componentProps.prefillValue).toBe('Forced query')
    expect(binding.componentProps.prefillForceSearchToken).toBe(3)
  })
})
