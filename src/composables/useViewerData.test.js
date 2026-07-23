import { describe, expect, test } from 'vitest'
import { ref } from 'vue'
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

  test('parseJsonPayload accepts suspendedItems array', () => {
    const payload = JSON.stringify({
      data: [{ a: 1 }, { a: 2 }],
      suspendedItems: [1],
    })
    const result = __test.parseJsonPayload(payload)

    expect(result.ok).toBe(true)
    expect(result.suspendedItems).toEqual([1])
  })

  test('parseJsonPayload rejects non-array suspendedItems', () => {
    const payload = JSON.stringify({
      data: [{ a: 1 }],
      suspendedItems: { index: 0 },
    })
    const result = __test.parseJsonPayload(payload)

    expect(result.ok).toBe(false)
  })

  test('only filters for search queries longer than two chars', () => {
    const model = useViewerData()
    model.initializeFromJsonArray([
      { inventory_number: 'A1', species: 'Oak' },
      { inventory_number: 'B2', species: 'Pine' },
    ])

    model.searchQuery.value = 'pi'
    expect(model.filteredViewItems.value).toHaveLength(2)

    model.searchQuery.value = 'pin'
    expect(model.filteredViewItems.value).toHaveLength(1)
    expect(model.rawItems.value[model.filteredViewItems.value[0]._index].species).toBe('Pine')
  })

  test('prioritizes label-field matches while searching all fields', () => {
    const itemLabelField = ref('title')
    const model = useViewerData({ itemLabelField })
    model.initializeFromJsonArray([
      { title: 'Unrelated heading', notes: 'needle appears only in notes' },
      { title: 'Needle in title', notes: 'other content' },
    ])

    model.searchQuery.value = 'needle'
    expect(model.filteredViewItems.value).toHaveLength(2)

    const firstMatch = model.rawItems.value[model.filteredViewItems.value[0]._index]
    expect(firstMatch.title).toBe('Needle in title')
  })

  test('pushes items with non-empty edited-basis field to the end', () => {
    const markAsEditedBasis = ref('edited_note')
    const model = useViewerData({ markAsEditedBasis })
    model.initializeFromJsonArray([
      { inventory_number: 'A1', edited_note: '' },
      { inventory_number: 'B2', edited_note: 'done' },
      { inventory_number: 'C3', edited_note: null },
    ])

    const orderedInventoryNumbers = model.filteredViewItems.value.map(
      (item) => model.rawItems.value[item._index].inventory_number,
    )

    expect(orderedInventoryNumbers).toEqual(['A1', 'C3', 'B2'])
  })

  test('keeps edited-basis sorting in filtered results', () => {
    const markAsEditedBasis = ref('edited_note')
    const model = useViewerData({ markAsEditedBasis })
    model.initializeFromJsonArray([
      { inventory_number: 'A1', species: 'Oak', edited_note: '' },
      { inventory_number: 'B2', species: 'Oak', edited_note: 'done' },
    ])

    model.searchQuery.value = 'oak'

    const orderedInventoryNumbers = model.filteredViewItems.value.map(
      (item) => model.rawItems.value[item._index].inventory_number,
    )

    expect(orderedInventoryNumbers).toEqual(['A1', 'B2'])
  })

  test('supports inverted edited-basis sorting (edited items first)', () => {
    const markAsEditedBasis = ref('edited_note')
    const markAsEditedItemsFirst = ref(true)
    const model = useViewerData({ markAsEditedBasis, markAsEditedItemsFirst })
    model.initializeFromJsonArray([
      { inventory_number: 'A1', edited_note: '' },
      { inventory_number: 'B2', edited_note: 'done' },
      { inventory_number: 'C3', edited_note: null },
    ])

    const orderedInventoryNumbers = model.filteredViewItems.value.map(
      (item) => model.rawItems.value[item._index].inventory_number,
    )

    expect(orderedInventoryNumbers).toEqual(['B2', 'A1', 'C3'])
  })

  test('pushes suspendEditing items to the end', () => {
    const model = useViewerData()
    model.initializeFromJsonArray([
      { inventory_number: 'A1' },
      { inventory_number: 'B2' },
      { inventory_number: 'C3' },
    ], 'sample.json', [1])

    const orderedInventoryNumbers = model.filteredViewItems.value.map(
      (item) => model.rawItems.value[item._index].inventory_number,
    )

    expect(orderedInventoryNumbers).toEqual(['A1', 'C3', 'B2'])
  })

  test('keeps suspendEditing items before edited-end items', () => {
    const markAsEditedBasis = ref('edited_note')
    const model = useViewerData({ markAsEditedBasis })
    model.initializeFromJsonArray([
      { inventory_number: 'A1', edited_note: '' },
      { inventory_number: 'B2', edited_note: '' },
      { inventory_number: 'C3', edited_note: 'done' },
      { inventory_number: 'D4', edited_note: 'done' },
    ], 'sample.json', [1, 3])

    const orderedInventoryNumbers = model.filteredViewItems.value.map(
      (item) => model.rawItems.value[item._index].inventory_number,
    )

    expect(orderedInventoryNumbers).toEqual(['A1', 'B2', 'C3', 'D4'])
  })

  test('updates suspendEditing via uid helper and marks model dirty', () => {
    const model = useViewerData()
    model.initializeFromJsonArray([{ inventory_number: 'A1' }])

    const uid = model.viewItems.value[0]._uid
    const updated = model.toggleSuspendEditingByUid(uid, true)

    expect(updated).toBe(true)
    expect(model.suspendedItemIndices.value).toEqual([0])
    expect(model.isDirty.value).toBe(true)
  })

  test('imports and exports suspended item indices separately from data', () => {
    const model = useViewerData()
    const payload = JSON.stringify({
      data: [{ inventory_number: 'A1' }, { inventory_number: 'B2' }],
      suspendedItems: [1],
    })

    const ok = model.importFromJsonText(payload, 'sample.json')

    expect(ok).toBe(true)
    expect(model.suspendedItemIndices.value).toEqual([1])
    expect(model.rawItems.value[1].suspendEditing).toBeUndefined()
    expect(model.createSuspendedItemsPayload()).toEqual([1])
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

  test('appendOnlineDraftItem appends a selectable draft with type defaults and online meta', () => {
    const model = useViewerData()
    model.initializeFromJsonArray([{ inventory_number: 'A1', scan: 'https://example.com/a.jpg' }])

    const nextUid = model.appendOnlineDraftItem({
      fieldConfigs: {
        inventory_number: { type: 'normal', order: 0 },
        year: { type: 'integer', order: 1 },
        reviewed: { type: 'checkbox', order: 2 },
        subject: { type: 'wikidata-autosuggest', order: 3 },
      },
      itemsPath: '/api/items?populate=*',
      includeScan: true,
    })

    expect(model.rawItems.value).toHaveLength(2)
    const draft = model.rawItems.value[1]
    expect(draft.inventory_number).toBe('')
    expect(draft.year).toBeNull()
    expect(draft.reviewed).toBe(false)
    expect(draft.subject).toEqual([])
    expect(draft.scan).toBe('')
    expect(draft.__onlineMeta.isDraft).toBe(true)
    expect(draft.__onlineMeta.draftId).toMatch(/^draft-/)
    expect(draft.__onlineMeta.itemsPath).toBe('/api/items')
    expect(model.isDirty.value).toBe(true)

    const draftViewItem = model.viewItems.value[1]
    expect(draftViewItem._uid).toBe(nextUid)
    expect(draftViewItem._index).toBe(1)

    model.selectItem(nextUid)
    expect(model.selectedRawItem.value).toBe(draft)

    const updated = model.updateField('inventory_number', 'NEW-1', 'normal')
    expect(updated).toBe(true)
    expect(draft.inventory_number).toBe('NEW-1')
  })

  test('appendOnlineDraftItem draft is dropped on reset unless synced into the snapshot', () => {
    const model = useViewerData()
    model.initializeFromJsonArray([{ inventory_number: 'A1' }])

    model.appendOnlineDraftItem({
      fieldConfigs: { inventory_number: { type: 'normal', order: 0 } },
      itemsPath: '/api/items',
    })

    expect(model.rawItems.value).toHaveLength(2)
    expect(model.importSnapshot.value).toHaveLength(1)

    model.resetToImportedSnapshot()
    expect(model.rawItems.value).toHaveLength(1)

    model.appendOnlineDraftItem({
      fieldConfigs: { inventory_number: { type: 'normal', order: 0 } },
      itemsPath: '/api/items',
    })
    expect(model.syncSnapshotItemAtIndex(1)).toBe(true)
    expect(model.importSnapshot.value).toHaveLength(2)

    model.resetToImportedSnapshot()
    expect(model.rawItems.value).toHaveLength(2)
  })

  test('syncSnapshotItemAtIndex rejects invalid indices', () => {
    const model = useViewerData()
    model.initializeFromJsonArray([{ inventory_number: 'A1' }])

    expect(model.syncSnapshotItemAtIndex(-1)).toBe(false)
    expect(model.syncSnapshotItemAtIndex(5)).toBe(false)
    expect(model.syncSnapshotItemAtIndex('1')).toBe(false)
  })
})
