// Derivation rules (`viewer-setting.mappings`): how an item of the loaded collection becomes a new
// item of another collection. One rule per source collection:
//
//   {
//     source: '/api/index-cards', target: '/api/collection-items',
//     label: { de: 'Als Objekt anlegen', en: 'Create object' },
//     relationField: 'index_cards',          // relation attribute on the target collection
//     fields: [
//       { target: 'label', from: 'label', prefix: 'item_' },   // copy, optionally with a prefix
//       { target: 'status', value: 'draft' },                  // constant
//     ],
//   }
//
// Pure functions only; loading, saving and the click flow live elsewhere.

const ONLINE_META_KEY = '__onlineMeta'

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function trimmedString(value) {
  return typeof value === 'string' ? value.trim() : ''
}

/** `/api/x?y#z/` → `/api/x`, so paths from settings and rules compare reliably. */
export function normalizeCollectionPath(path) {
  const withoutQuery = trimmedString(path).split('#')[0].split('?')[0]
  return withoutQuery.replace(/\/+$/, '')
}

function isConstantMapping(raw) {
  return Object.prototype.hasOwnProperty.call(raw, 'value')
}

function normalizeFieldMapping(raw) {
  if (!isPlainObject(raw)) return null
  const target = trimmedString(raw.target)
  if (!target) return null
  if (isConstantMapping(raw)) return { target, value: raw.value }

  const from = trimmedString(raw.from)
  if (!from) return null
  const prefix = typeof raw.prefix === 'string' ? raw.prefix : ''
  return prefix ? { target, from, prefix } : { target, from }
}

function normalizeRuleLabel(value) {
  if (typeof value === 'string') return value.trim() ? { de: value.trim(), en: value.trim() } : {}
  if (!isPlainObject(value)) return {}
  const label = {}
  Object.entries(value).forEach(([language, text]) => {
    if (trimmedString(text)) label[language] = text.trim()
  })
  return label
}

function normalizeRule(raw) {
  if (!isPlainObject(raw)) return null
  const source = normalizeCollectionPath(raw.source)
  if (!source) return null
  const fields = Array.isArray(raw.fields) ? raw.fields.map(normalizeFieldMapping).filter(Boolean) : []
  return {
    source,
    target: normalizeCollectionPath(raw.target),
    label: normalizeRuleLabel(raw.label),
    relationField: trimmedString(raw.relationField),
    fields,
  }
}

/** The usable rules of a `mappings` value; anything that is not a rule list gives `[]`. */
export function normalizeDerivationRules(value) {
  if (!Array.isArray(value)) return []
  return value.map(normalizeRule).filter(Boolean)
}

export function findRuleForSource(rules, sourcePath) {
  const normalizedSource = normalizeCollectionPath(sourcePath)
  if (!normalizedSource || !Array.isArray(rules)) return null
  return rules.find((rule) => rule.source === normalizedSource) || null
}

/** Replaces the rule with the same source, or appends it; the other rules stay as they are. */
export function upsertRuleForSource(rules, rule) {
  const list = Array.isArray(rules) ? rules : []
  const others = list.filter((entry) => entry.source !== rule.source)
  return [...others, rule]
}

/** Problems that stop a rule from working, as message keys with English fallbacks. */
export function validateDerivationRule(rule) {
  const errors = []
  if (!rule?.target) errors.push({ key: 'deriveRuleTargetMissing', fallback: 'Choose a target collection.' })
  if (rule?.target && rule.target === rule.source) {
    errors.push({ key: 'deriveRuleTargetIsSource', fallback: 'The target must be another collection.' })
  }
  if (!rule?.relationField) {
    errors.push({ key: 'deriveRuleRelationMissing', fallback: 'Choose the relation field of the target collection.' })
  }
  if (!rule?.fields?.length) {
    errors.push({ key: 'deriveRuleFieldsMissing', fallback: 'Map at least one field.' })
  }
  const targets = (rule?.fields || []).map((field) => field.target)
  if (new Set(targets).size !== targets.length) {
    errors.push({ key: 'deriveRuleDuplicateTarget', fallback: 'Each target field may be mapped only once.' })
  }
  return errors
}

export function resolveRuleLabel(rule, language, fallback) {
  const label = rule?.label || {}
  return label[language] || label.de || label.en || fallback
}

function hasValue(value) {
  if (value == null) return false
  if (typeof value === 'string') return value.trim().length > 0
  return true
}

/** The field values of a Strapi row (v5 flat or v4 `{ attributes }`). */
export function readRowValues(row) {
  if (!isPlainObject(row)) return {}
  return isPlainObject(row.attributes) ? row.attributes : row
}

/** The viewer item's own values, without the internal metadata. */
export function readLocalItemValues(item) {
  if (!isPlainObject(item)) return {}
  const values = { ...item }
  delete values[ONLINE_META_KEY]
  return values
}

function deriveFieldValue(mapping, sourceValues) {
  if (isConstantMapping(mapping)) return mapping.value
  const value = sourceValues[mapping.from]
  if (!hasValue(value)) return undefined
  return mapping.prefix ? `${mapping.prefix}${value}` : value
}

/** The target item's field values; a copied field whose source is empty is left out. */
export function buildDerivedFields(rule, sourceValues = {}) {
  const fields = {}
  ;(rule?.fields || []).forEach((mapping) => {
    const value = deriveFieldValue(mapping, sourceValues)
    if (value !== undefined) fields[mapping.target] = value
  })
  return fields
}

/** The relation value that links the new item to its source (Strapi `connect`). */
export function buildRelationConnect(sourceMeta) {
  if (!isPlainObject(sourceMeta)) return null
  const key = sourceMeta.idKind === 'id' ? 'id' : 'documentId'
  if (sourceMeta.id == null || sourceMeta.id === '') return null
  return { connect: [{ [key]: sourceMeta.id }] }
}

/** The body fields of the create request: the derived values plus the relation to the source. */
export function buildDerivedItemPayload(rule, sourceValues, sourceMeta) {
  const fields = buildDerivedFields(rule, sourceValues)
  const connect = buildRelationConnect(sourceMeta)
  if (rule?.relationField && connect) fields[rule.relationField] = connect
  return fields
}

/** `{ id, label }` of the created item, for the success message. */
export function describeCreatedItem(responsePayload, derivedFields = {}) {
  const row = readRowValues(responsePayload?.data)
  const container = isPlainObject(responsePayload?.data) ? responsePayload.data : {}
  const id = container.documentId ?? container.id ?? row.documentId ?? row.id ?? ''
  const label = [row.label, ...Object.values(derivedFields)].find(
    (value) => typeof value === 'string' && value.trim(),
  )
  return { id: String(id), label: label ? label.trim() : '' }
}
