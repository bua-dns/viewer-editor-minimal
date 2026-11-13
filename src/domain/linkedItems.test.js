import { describe, expect, test } from 'vitest'
import {
  describeLinkedItem,
  linkedItemKey,
  pickLanguageText,
  prepareLinkedItem,
  resolveLinkTarget,
} from './linkedItems'

describe('linked items', () => {
  test('a saved item is a link target, a draft is not', () => {
    expect(resolveLinkTarget({ __onlineMeta: { id: 'abc', idKind: 'documentId' } })).toEqual({
      id: 'abc',
      idKind: 'documentId',
    })
    expect(resolveLinkTarget({ __onlineMeta: { id: 3, idKind: 'id' } })).toEqual({ id: 3, idKind: 'id' })
    expect(resolveLinkTarget({ __onlineMeta: { isDraft: true, draftId: 'd1' } })).toBe(null)
    expect(resolveLinkTarget({ label: 'offline' })).toBe(null)
  })

  test('the key combines collection path and id', () => {
    expect(linkedItemKey({ __onlineMeta: { itemsPath: '/api/x', id: 'a' } })).toBe('/api/x::a')
  })

  test('configured fields are added with defaults and normalized', () => {
    const item = prepareLinkedItem({ label: 'L', present: 'true' }, {
      label: { type: 'normal' },
      present: { type: 'checkbox' },
      remarks: { type: 'text' },
    })
    expect(item.label).toBe('L')
    expect(item.present).toBe(true)
    expect(item.remarks).toBe('')
  })

  test('the header is the label field value, else the id', () => {
    const item = { label: ' item_1 ', __onlineMeta: { id: 'doc1' } }
    expect(describeLinkedItem(item, 'label')).toBe('item_1')
    expect(describeLinkedItem({ ...item, label: '' }, 'label')).toBe('doc1')
    expect(describeLinkedItem(item, '')).toBe('doc1')
  })

  test('language maps fall back to de, en, then any entry', () => {
    expect(pickLanguageText({ de: 'Objekte', en: 'Items' }, 'en')).toBe('Items')
    expect(pickLanguageText({ de: 'Objekte' }, 'en')).toBe('Objekte')
    expect(pickLanguageText({ fr: 'Objets' }, 'en')).toBe('Objets')
    expect(pickLanguageText(null, 'en')).toBe('')
  })
})
