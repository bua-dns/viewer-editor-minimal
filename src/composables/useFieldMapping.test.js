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
})
