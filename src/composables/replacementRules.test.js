import { describe, expect, test } from 'vitest'
import {
  collectReplaceableFieldKeys,
  collectRulesForField,
  computeReplacementChanges,
  computeReplacementChangesForItem,
  countChangedFields,
  hasReplacementRules,
  replaceAllOccurrences,
} from './replacementRules'

const fieldConfigs = {
  title: { type: 'normal' },
  notes: { type: 'text' },
  count: { type: 'integer' },
  done: { type: 'checkbox' },
  place: { type: 'wikidata-autosuggest' },
  suggestion: { type: 'candidate', candidate: { targetField: 'title' } },
  legacy: {},
  locked: { type: 'normal', readOnly: true },
}

describe('replacement rule engine', () => {
  test('only normal and text fields are replaceable, read-only excluded', () => {
    expect(collectReplaceableFieldKeys(fieldConfigs)).toEqual(['title', 'notes', 'legacy'])
  })

  test('replaces every occurrence literally and case-sensitively', () => {
    expect(replaceAllOccurrences('Berlin, berlin, BERLIN', 'berlin', 'Potsdam')).toBe(
      'Berlin, Potsdam, BERLIN',
    )
    expect(replaceAllOccurrences('a.b.c', '.', '-')).toBe('a-b-c')
    expect(replaceAllOccurrences('keep', '', 'x')).toBe('keep')
    expect(replaceAllOccurrences(42, '4', '5')).toBe(42)
  })

  test('collects allFields rules before field specific ones', () => {
    const replacements = {
      allFields: { foo: 'bar' },
      title: { bar: 'baz' },
      notes: { unrelated: 'x' },
    }

    expect(collectRulesForField(replacements, 'title')).toEqual([
      { search: 'foo', replacement: 'bar' },
      { search: 'bar', replacement: 'baz' },
    ])
    expect(collectRulesForField(replacements, 'allFields')).toEqual([
      { search: 'foo', replacement: 'bar' },
    ])
  })

  test('applies allFields and field rules, skipping ineligible fields', () => {
    const item = {
      title: 'Gruenberg i. Schl.',
      notes: 'Fundort Gruenberg i. Schl., 1912',
      count: 3,
      done: false,
      locked: 'Gruenberg i. Schl.',
      place: [{ id: 'Q1', label: 'Gruenberg i. Schl.' }],
    }

    const changedFields = computeReplacementChangesForItem(
      item,
      { allFields: { 'i. Schl.': 'in Schlesien' }, notes: { Fundort: 'Fundstelle' } },
      fieldConfigs,
    )

    expect(changedFields).toEqual({
      title: 'Gruenberg in Schlesien',
      notes: 'Fundstelle Gruenberg in Schlesien, 1912',
    })
  })

  test('empty replacement text deletes the search text', () => {
    const changedFields = computeReplacementChangesForItem(
      { title: 'Karte [Entwurf]' },
      { title: { ' [Entwurf]': '' } },
      fieldConfigs,
    )

    expect(changedFields).toEqual({ title: 'Karte' })
  })

  test('ignores rules with non-primitive replacement values', () => {
    const changedFields = computeReplacementChangesForItem(
      { title: 'abc' },
      { title: { a: { nested: true }, b: 'B' } },
      fieldConfigs,
    )

    expect(changedFields).toEqual({ title: 'aBc' })
  })

  test('collects changes per item index and counts changed fields', () => {
    const items = [
      { title: 'Berlin' },
      { title: 'Hamburg' },
      { title: 'Berlin', notes: 'Berlin' },
    ]

    const changes = computeReplacementChanges(items, { allFields: { Berlin: 'Potsdam' } }, fieldConfigs)

    expect(changes).toEqual([
      { index: 0, changedFields: { title: 'Potsdam' } },
      { index: 2, changedFields: { title: 'Potsdam', notes: 'Potsdam' } },
    ])
    expect(countChangedFields(changes)).toBe(3)
  })

  test('detects whether any rule exists', () => {
    expect(hasReplacementRules({})).toBe(false)
    expect(hasReplacementRules({ allFields: {} })).toBe(false)
    expect(hasReplacementRules({ allFields: { a: 'b' } })).toBe(true)
  })
})
