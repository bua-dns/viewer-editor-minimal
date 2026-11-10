import { describe, expect, test } from 'vitest'
import {
  buildDerivedFields,
  buildDerivedItemPayload,
  describeCreatedItem,
  findRuleForSource,
  normalizeDerivationRules,
  readLocalItemValues,
  readRowValues,
  resolveRuleLabel,
  upsertRuleForSource,
  validateDerivationRule,
} from './derivationRules'

const rule = {
  source: '/api/index-cards',
  target: '/api/collection-items',
  label: { de: 'Als Objekt anlegen', en: 'Create object' },
  relationField: 'index_cards',
  fields: [
    { target: 'label', from: 'label', prefix: 'item_' },
    { target: 'name', from: 'ai_scientific_name' },
    { target: 'status', value: 'draft' },
  ],
}

describe('normalizeDerivationRules', () => {
  test('anything that is not a list (null from Strapi) gives no rules', () => {
    expect(normalizeDerivationRules(null)).toEqual([])
    expect(normalizeDerivationRules({ source: '/api/a' })).toEqual([])
  })

  test('normalizes paths and drops unusable rules and field mappings', () => {
    const rules = normalizeDerivationRules([
      {
        source: ' /api/index-cards/?x=1 ',
        target: '/api/collection-items',
        label: 'Ableiten',
        relationField: ' index_cards ',
        fields: [
          { target: 'label', from: 'label', prefix: 'item_' },
          { target: 'status', value: '' },
          { target: '', from: 'label' },
          { target: 'name' },
          'nonsense',
        ],
      },
      { target: '/api/x' },
      null,
    ])
    expect(rules).toEqual([
      {
        ...rule,
        label: { de: 'Ableiten', en: 'Ableiten' },
        fields: [rule.fields[0], { target: 'status', value: '' }],
      },
    ])
  })
})

describe('findRuleForSource / upsertRuleForSource', () => {
  test('finds the rule of the loaded collection, ignoring query and trailing slash', () => {
    expect(findRuleForSource([rule], '/api/index-cards/?populate=*')).toBe(rule)
    expect(findRuleForSource([rule], '/api/other')).toBeNull()
    expect(findRuleForSource([rule], '')).toBeNull()
  })

  test('replaces the rule of the same source and keeps the others', () => {
    const other = { ...rule, source: '/api/other' }
    const changed = { ...rule, target: '/api/persons' }
    expect(upsertRuleForSource([rule, other], changed)).toEqual([other, changed])
    expect(upsertRuleForSource(null, rule)).toEqual([rule])
  })
})

describe('validateDerivationRule', () => {
  test('a complete rule has no errors', () => {
    expect(validateDerivationRule(rule)).toEqual([])
  })

  test('reports a missing target, relation and fields', () => {
    const keys = validateDerivationRule({ source: '/api/a', target: '', relationField: '', fields: [] }).map(
      (error) => error.key,
    )
    expect(keys).toEqual(['deriveRuleTargetMissing', 'deriveRuleRelationMissing', 'deriveRuleFieldsMissing'])
  })

  test('rejects the source as target and a target field mapped twice', () => {
    const keys = validateDerivationRule({
      ...rule,
      target: rule.source,
      fields: [
        { target: 'label', from: 'label' },
        { target: 'label', value: 'x' },
      ],
    }).map((error) => error.key)
    expect(keys).toEqual(['deriveRuleTargetIsSource', 'deriveRuleDuplicateTarget'])
  })
})

describe('resolveRuleLabel', () => {
  test('uses the current language, then de/en, then the fallback', () => {
    expect(resolveRuleLabel(rule, 'en', 'Derive item')).toBe('Create object')
    expect(resolveRuleLabel(rule, 'fr', 'Derive item')).toBe('Als Objekt anlegen')
    expect(resolveRuleLabel({ ...rule, label: {} }, 'en', 'Derive item')).toBe('Derive item')
  })
})

describe('buildDerivedFields', () => {
  test('copies with prefix, copies plainly and sets constants', () => {
    expect(buildDerivedFields(rule, { label: '0_00571', ai_scientific_name: 'Pandanus hornei' })).toEqual({
      label: 'item_0_00571',
      name: 'Pandanus hornei',
      status: 'draft',
    })
  })

  test('leaves out copied fields whose source is empty, but keeps false and 0', () => {
    const fields = buildDerivedFields(
      {
        fields: [
          { target: 'label', from: 'label', prefix: 'item_' },
          { target: 'flag', from: 'flag' },
          { target: 'count', from: 'count' },
        ],
      },
      { label: '  ', flag: false, count: 0 },
    )
    expect(fields).toEqual({ flag: false, count: 0 })
  })
})

describe('buildDerivedItemPayload', () => {
  test('adds the relation to the source item by documentId', () => {
    const payload = buildDerivedItemPayload(rule, { label: 'A' }, { id: 'doc-1', idKind: 'documentId' })
    expect(payload).toEqual({
      label: 'item_A',
      status: 'draft',
      index_cards: { connect: [{ documentId: 'doc-1' }] },
    })
  })

  test('uses the numeric id when the source has no documentId', () => {
    const payload = buildDerivedItemPayload(rule, {}, { id: 7, idKind: 'id' })
    expect(payload.index_cards).toEqual({ connect: [{ id: 7 }] })
  })

  test('without a source id there is no relation', () => {
    expect(buildDerivedItemPayload(rule, {}, {})).toEqual({ status: 'draft' })
  })
})

describe('row and item values', () => {
  test('reads flat and attributes rows', () => {
    expect(readRowValues({ id: 1, label: 'a' })).toEqual({ id: 1, label: 'a' })
    expect(readRowValues({ id: 1, attributes: { label: 'a' } })).toEqual({ label: 'a' })
    expect(readRowValues(null)).toEqual({})
  })

  test('drops the internal metadata of a viewer item', () => {
    expect(readLocalItemValues({ label: 'a', __onlineMeta: { id: 'x' } })).toEqual({ label: 'a' })
  })
})

describe('describeCreatedItem', () => {
  test('takes documentId and the label of the response', () => {
    expect(describeCreatedItem({ data: { documentId: 'new-1', label: 'item_A' } })).toEqual({
      id: 'new-1',
      label: 'item_A',
    })
  })

  test('falls back to the first derived text when the response has no label', () => {
    expect(describeCreatedItem({ data: { id: 5 } }, { count: 3, name: 'Pandanus' })).toEqual({
      id: '5',
      label: 'Pandanus',
    })
  })
})
