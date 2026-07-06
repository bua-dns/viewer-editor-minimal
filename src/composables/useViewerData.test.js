import { describe, expect, test } from 'vitest'
import { __test, useViewerData } from './useViewerData'

describe('useViewerData helpers', () => {
  test('parseJsonPayload validates top-level array', () => {
    expect(__test.parseJsonPayload('{"a":1}').ok).toBe(false)
    expect(__test.parseJsonPayload('[{"a":1}]').ok).toBe(true)
  })

  test('parseJsonPayload accepts embedded data and config', () => {
    const payload = JSON.stringify({
      data: [{ a: 1 }],
      config: { version: 1, fields: { a: { type: 'normal', label: '', order: 0, placeholder: '' } } },
      ignored: true,
    })
    const result = __test.parseJsonPayload(payload)
    expect(result.ok).toBe(true)
    expect(result.data).toHaveLength(1)
    expect(result.hasConfig).toBe(true)
    expect(result.config?.version).toBe(1)
  })

  test('parseJsonPayload rejects non-array data object', () => {
    const result = __test.parseJsonPayload('{"data":{"a":1}}')
    expect(result.ok).toBe(false)
  })

  test('tokenize splits search query', () => {
    expect(__test.tokenize('  Alpha  beta  ')).toEqual(['alpha', 'beta'])
  })

  test('looksLikeImageUrl detects image links', () => {
    expect(__test.looksLikeImageUrl('https://example.com/a.jpg')).toBe(true)
    expect(__test.looksLikeImageUrl('/sample-card-1.jpg')).toBe(true)
    expect(__test.looksLikeImageUrl('https://example.com/a')).toBe(false)
  })

  test('parseCsvText parses CSV rows and preserves scan column', () => {
    const csv = 'inventory_number,scan,species\nA1,https://example.com/a.jpg,Oak\nB2,https://example.com/b.jpg,Pine'
    const result = __test.parseCsvText(csv)
    expect(result.ok).toBe(true)
    expect(result.data).toHaveLength(2)
    expect(result.data[0].scan).toBe('https://example.com/a.jpg')
    expect(result.data[1].species).toBe('Pine')
  })

  test('splitCsvLine handles quoted commas and escaped quotes', () => {
    const values = __test.splitCsvLine('A1,"Oak, Large","He said ""hi"""')
    expect(values).toEqual(['A1', 'Oak, Large', 'He said "hi"'])
  })

  test('parseCsvText keeps empty values and pads missing trailing columns', () => {
    const csv = 'inventory_number,species,notes\nA1,,\nB2,Pine'
    const result = __test.parseCsvText(csv)

    expect(result.ok).toBe(true)
    expect(result.data).toEqual([
      { inventory_number: 'A1', species: '', notes: '' },
      { inventory_number: 'B2', species: 'Pine', notes: '' },
    ])
  })

  test('parseCsvText rejects rows with more columns than header', () => {
    const csv = 'inventory_number,species\nA1,Oak,EXTRA'

    expect(() => __test.parseCsvText(csv)).toThrow('Zeile 2 hat mehr Spalten als der Header.')
  })

  test('CSV parse-export roundtrip preserves significant whitespace in values', () => {
    const csv = [
      'id,plain,quoted',
      '1,  padded  ,"  padded in quotes  "',
      '2,unquoted with trailing spaces   ,"quoted with trailing spaces   "',
    ].join('\n')

    const parsed = __test.parseCsvText(csv)
    expect(parsed.ok).toBe(true)
    expect(parsed.data[0]).toEqual({
      id: '1',
      plain: '  padded  ',
      quoted: '  padded in quotes  ',
    })
    expect(parsed.data[1]).toEqual({
      id: '2',
      plain: 'unquoted with trailing spaces   ',
      quoted: 'quoted with trailing spaces   ',
    })

    const exported = __test.createCsvTextFromItems(parsed.data)
    const reparsed = __test.parseCsvText(exported)

    expect(reparsed.ok).toBe(true)
    expect(reparsed.data).toEqual(parsed.data)
  })

  test('createCsvTextFromItems creates csv export text', () => {
    const csv = __test.createCsvTextFromItems([
      { a: 'A', b: 'B' },
      { a: 'A2', b: 'B2' },
    ])
    expect(csv).toContain('a,b')
    expect(csv).toContain('A2,B2')
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

  test('imports csv data', () => {
    const model = useViewerData()
    const csv = 'inventory_number,scan\nA1,https://example.com/a.jpg'
    const ok = model.importFromCsvText(csv, 'sample.csv')

    expect(ok).toBe(true)
    expect(model.rawItems.value).toHaveLength(1)
    expect(model.rawItems.value[0].scan).toBe('https://example.com/a.jpg')
    expect(model.importFileName.value).toBe('sample.csv')
  })

  test('updates wikidata-autosuggest fields as entity arrays', () => {
    const model = useViewerData()
    model.initializeFromJsonArray([
      {
        inventory_number: 'A1',
        subject: null,
      },
    ])

    model.selectItem(model.viewItems.value[0]._uid)

    const updated = model.updateField(
      'subject',
      [{ id: 'Q42', label: 'Douglas Adams', description: 'English writer' }],
      'wikidata-autosuggest',
    )

    expect(updated).toBe(true)
    expect(model.rawItems.value[0].subject).toEqual([
      { id: 'Q42', label: 'Douglas Adams', description: 'English writer' },
    ])
  })

  test('preserves entity metadata across export-import roundtrip', () => {
    const model = useViewerData()
    const source = [
      {
        inventory_number: 'A1',
        subject: [
          {
            id: 'Q42',
            label: 'Douglas Adams',
            description: 'English writer',
            ranking: { score: 10 },
          },
        ],
      },
    ]

    model.initializeFromJsonArray(source)
    const exportPayload = model.createExportPayload()
    const importResult = model.importFromJsonText(JSON.stringify({ data: exportPayload }), 'roundtrip.json')

    expect(importResult).toBe(true)
    expect(model.rawItems.value[0].subject).toEqual([
      {
        id: 'Q42',
        label: 'Douglas Adams',
        description: 'English writer',
        ranking: { score: 10 },
      },
    ])
  })
})
