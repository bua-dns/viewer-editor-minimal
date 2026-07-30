import { beforeEach, describe, expect, test } from 'vitest'
import { useFieldMapping } from './useFieldMapping'
import { useUserConfigStore } from '../stores/useUserConfigStore'

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

  test('never shows suspendEditing as editable field key', () => {
    const { getDisplayedFieldKeys } = useFieldMapping()
    const keys = getDisplayedFieldKeys({
      title: 'A',
      suspendEditing: true,
      note: 'B',
    })

    expect(keys).toEqual(['title', 'note'])
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
