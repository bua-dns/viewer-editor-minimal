import { describe, expect, test } from 'vitest'
import { __test, useViewerData } from './useViewerData'

describe('useViewerData helpers', () => {
  test('parseJsonArray validates top-level array', () => {
    expect(__test.parseJsonArray('{"a":1}').ok).toBe(false)
    expect(__test.parseJsonArray('[{"a":1}]').ok).toBe(true)
  })

  test('tokenize splits search query', () => {
    expect(__test.tokenize('  Alpha  beta  ')).toEqual(['alpha', 'beta'])
  })

  test('looksLikeImageUrl detects image links', () => {
    expect(__test.looksLikeImageUrl('https://example.com/a.jpg')).toBe(true)
    expect(__test.looksLikeImageUrl('https://example.com/a')).toBe(false)
  })
})

describe('useViewerData flow', () => {
  test('import, search, update and reset', () => {
    const model = useViewerData()
    const source = [
      { inventory_number: 'A1', species: 'Oak', scan: 'https://example.com/a.jpg' },
      { inventory_number: 'B2', species: 'Pine', scan: 'https://example.com/b.jpg' },
    ]

    model.initializeFromJsonArray(source, 'sample.json')
    expect(model.rawItems.value).toHaveLength(2)

    model.searchQuery.value = 'pine'
    expect(model.filteredViewItems.value).toHaveLength(1)

    const pineUid = model.filteredViewItems.value[0]._uid
    model.selectItem(pineUid)
    const updated = model.updateField('species', 'Larch')
    expect(updated).toBe(true)
    expect(model.isDirty.value).toBe(true)
    expect(model.rawItems.value[1].species).toBe('Larch')

    model.resetToImportedSnapshot()
    expect(model.rawItems.value[1].species).toBe('Pine')
    expect(model.isDirty.value).toBe(false)
  })
})
