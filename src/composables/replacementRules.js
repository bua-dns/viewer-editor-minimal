import { resolveConfiguredFieldType } from '../fields/fieldRegistry'

export const ALL_FIELDS_REPLACEMENT_KEY = 'allFields'

const REPLACEABLE_FIELD_TYPES = ['normal', 'text']
const RESERVED_FIELD_KEYS = ['scan', 'suspendEditing', '__onlineMeta']

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

export function isReplaceableFieldType(type) {
  return REPLACEABLE_FIELD_TYPES.includes(resolveConfiguredFieldType(type))
}

/**
 * Field keys a replacement rule may touch: every configured field of type
 * `normal` or `text` that is neither reserved nor read-only.
 */
export function collectReplaceableFieldKeys(fieldConfigs = {}) {
  if (!isPlainObject(fieldConfigs)) return []

  return Object.keys(fieldConfigs).filter((key) => {
    if (RESERVED_FIELD_KEYS.includes(key)) return false
    const config = isPlainObject(fieldConfigs[key]) ? fieldConfigs[key] : {}
    if (config.readOnly === true) return false
    return isReplaceableFieldType(config.type)
  })
}

/** Literal, case-sensitive replacement of every occurrence. */
export function replaceAllOccurrences(text, searchText, replacementText) {
  if (typeof text !== 'string') return text
  const search = String(searchText ?? '')
  if (!search) return text
  return text.split(search).join(String(replacementText ?? ''))
}

function normalizeRuleReplacement(value) {
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (value == null) return ''
  return null
}

function pushRulesFromMapping(rules, mapping) {
  if (!isPlainObject(mapping)) return
  Object.entries(mapping).forEach(([search, replacement]) => {
    if (typeof search !== 'string' || !search) return
    const normalizedReplacement = normalizeRuleReplacement(replacement)
    if (normalizedReplacement === null) return
    rules.push({ search, replacement: normalizedReplacement })
  })
}

/**
 * Rules that apply to one field: the `allFields` rules first, then the
 * field-specific ones, each in insertion order.
 */
export function collectRulesForField(replacements, fieldKey) {
  const rules = []
  if (!isPlainObject(replacements)) return rules

  pushRulesFromMapping(rules, replacements[ALL_FIELDS_REPLACEMENT_KEY])
  if (fieldKey !== ALL_FIELDS_REPLACEMENT_KEY) {
    pushRulesFromMapping(rules, replacements[fieldKey])
  }
  return rules
}

export function hasReplacementRules(replacements) {
  if (!isPlainObject(replacements)) return false
  return Object.values(replacements).some(
    (mapping) => isPlainObject(mapping) && Object.keys(mapping).length > 0,
  )
}

export function computeReplacementChangesForItem(item, replacements, fieldConfigs) {
  const changedFields = {}
  if (!isPlainObject(item)) return changedFields

  collectReplaceableFieldKeys(fieldConfigs).forEach((fieldKey) => {
    if (!Object.prototype.hasOwnProperty.call(item, fieldKey)) return

    const currentValue = item[fieldKey]
    if (typeof currentValue !== 'string') return

    const rules = collectRulesForField(replacements, fieldKey)
    if (!rules.length) return

    const nextValue = rules.reduce(
      (value, rule) => replaceAllOccurrences(value, rule.search, rule.replacement),
      currentValue,
    )
    if (nextValue !== currentValue) {
      changedFields[fieldKey] = nextValue
    }
  })

  return changedFields
}

export function computeReplacementChanges(items, replacements, fieldConfigs) {
  const changes = []
  ;(Array.isArray(items) ? items : []).forEach((item, index) => {
    const changedFields = computeReplacementChangesForItem(item, replacements, fieldConfigs)
    if (Object.keys(changedFields).length) {
      changes.push({ index, changedFields })
    }
  })
  return changes
}

export function countChangedFields(changes) {
  return (Array.isArray(changes) ? changes : []).reduce(
    (total, entry) => total + Object.keys(entry.changedFields || {}).length,
    0,
  )
}
