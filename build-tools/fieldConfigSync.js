// Field config sync: compares one field between two collections of a project — the Strapi schema
// attribute (type, component, repeatable) and the viewer field config in the collection attributes
// of the `viewer-setting` (v2 layout) — and builds the target config that makes them identical.
// Pure functions only; Strapi access is in fieldSyncStrapi.js, the CLI in syncFieldConfig.js.

import { isPlainObject } from '../src/domain/objects.js'

// Keys that belong to the collection, not to the field: never compared, never copied.
const COLLECTION_SPECIFIC_KEYS = ['order']
// The v1 attribute that some records still carry next to the v2 collection attributes.
const LEGACY_SETTINGS_KEY = 'settings'

/** The collection attributes of a viewer-setting record (`itemsPath` + `fields`), without v1 `settings`. */
export function listCollections(data) {
  if (!isPlainObject(data)) return []
  return Object.entries(data)
    .filter(([key, value]) => key !== LEGACY_SETTINGS_KEY && isPlainObject(value))
    .filter(([, value]) => typeof value.itemsPath === 'string' && isPlainObject(value.fields))
    .map(([id, value]) => ({ id, itemsPath: value.itemsPath, fieldCount: Object.keys(value.fields).length }))
}

function lastPathSegment(itemsPath) {
  const segments = String(itemsPath || '').split(/[?#]/)[0].split('/').filter(Boolean)
  return segments[segments.length - 1] || ''
}

/** The schema attributes of the content type behind `itemsPath` (matched by plural name), or null. */
export function findSchemaAttributes(contentTypesPayload, itemsPath) {
  const pluralName = lastPathSegment(itemsPath)
  const contentTypes = Array.isArray(contentTypesPayload?.data) ? contentTypesPayload.data : []
  const match = contentTypes.find((entry) => entry?.schema?.pluralName === pluralName)
  return isPlainObject(match?.schema?.attributes) ? match.schema.attributes : null
}

/** `component metadata-forms.x, repeatable` / `string` / `missing`, for messages. */
export function describeAttribute(attribute) {
  if (!isPlainObject(attribute)) return 'missing'
  if (attribute.type !== 'component') return String(attribute.type || 'unknown')
  return `component ${attribute.component}${attribute.repeatable ? ', repeatable' : ''}`
}

function schemaProblem(sourceAttribute, targetAttribute) {
  if (!isPlainObject(sourceAttribute)) return 'the field does not exist in the source collection'
  if (!isPlainObject(targetAttribute)) return 'the field does not exist in the target collection'
  if (sourceAttribute.type !== targetAttribute.type) return 'the field types differ'
  if (sourceAttribute.type !== 'component') return ''
  if (sourceAttribute.component !== targetAttribute.component) return 'the fields use different components'
  if (Boolean(sourceAttribute.repeatable) !== Boolean(targetAttribute.repeatable)) return 'one field is repeatable, the other is not'
  return ''
}

/** Whether the field has the same structure in both Strapi collections. */
export function compareSchemaAttributes(sourceAttribute, targetAttribute) {
  const problem = schemaProblem(sourceAttribute, targetAttribute)
  return {
    ok: !problem,
    problem,
    source: describeAttribute(sourceAttribute),
    target: describeAttribute(targetAttribute),
  }
}

/**
 * Fields of the source config: components first (by schema), within that the fields the target
 * configures too (those can be compared), then in config order.
 */
export function listFieldChoices(sourceCollection, targetCollection, sourceAttributes = {}) {
  const targetFields = isPlainObject(targetCollection?.fields) ? targetCollection.fields : {}
  const isComponent = (key) => sourceAttributes?.[key]?.type === 'component'
  return Object.entries(sourceCollection?.fields || {})
    .map(([key, config]) => ({
      key,
      isComponent: isComponent(key),
      inTarget: isPlainObject(targetFields[key]),
      order: Number.isFinite(config?.order) ? config.order : Infinity,
    }))
    .sort((a, b) => Number(b.isComponent) - Number(a.isComponent) || Number(b.inTarget) - Number(a.inTarget) || a.order - b.order)
    .map(({ key, isComponent: component, inTarget }) => ({ key, isComponent: component, inTarget }))
}

function nextOrder(targetFields) {
  const orders = Object.values(targetFields).map((config) => config?.order).filter(Number.isFinite)
  return orders.length ? Math.max(...orders) + 1 : 0
}

/**
 * The field config the target should have: the source config without `order` (the target keeps
 * its own, a new field goes to the end) and without a `prefillWith` that names a field the target
 * does not configure. `notes` says what was left out and why.
 */
export function syncedFieldConfig(sourceField, targetFields = {}, currentTargetField = null) {
  const config = { ...sourceField }
  const notes = []
  COLLECTION_SPECIFIC_KEYS.forEach((key) => delete config[key])
  if (config.prefillWith && !isPlainObject(targetFields[config.prefillWith])) {
    notes.push(`prefillWith "${config.prefillWith}" is left out: the target has no field "${config.prefillWith}".`)
    delete config.prefillWith
  }
  config.order = Number.isFinite(currentTargetField?.order) ? currentTargetField.order : nextOrder(targetFields)
  return { config, notes }
}

function withoutCollectionKeys(config) {
  const copy = { ...config }
  COLLECTION_SPECIFIC_KEYS.forEach((key) => delete copy[key])
  return copy
}

/** Key paths where `actual` differs from `expected` (objects compared key by key, arrays as a whole). */
export function diffValues(expected, actual, path = '') {
  if (isPlainObject(expected) && isPlainObject(actual)) {
    const keys = [...new Set([...Object.keys(expected), ...Object.keys(actual)])].sort()
    return keys.flatMap((key) => diffValues(expected[key], actual[key], path ? `${path}.${key}` : key))
  }
  if (JSON.stringify(expected) === JSON.stringify(actual)) return []
  return [{ path, expected, actual }]
}

/**
 * The check of one field: schema comparison, whether both sides configure it, and the config
 * differences (target compared with what a sync would write; `order` ignored).
 */
export function checkField({ field, sourceCollection, targetCollection, sourceAttributes, targetAttributes }) {
  const sourceField = sourceCollection?.fields?.[field]
  const targetFields = targetCollection?.fields || {}
  const targetField = targetFields[field]
  const schema = compareSchemaAttributes(sourceAttributes?.[field], targetAttributes?.[field])
  const configured = { source: isPlainObject(sourceField), target: isPlainObject(targetField) }
  if (!configured.source) return { field, schema, configured, differences: [], notes: [], identical: false }

  const { config, notes } = syncedFieldConfig(sourceField, targetFields, targetField)
  const differences = configured.target ? diffValues(withoutCollectionKeys(config), withoutCollectionKeys(targetField)) : []
  const identical = configured.target && !differences.length
  return { field, schema, configured, differences, notes, identical }
}

/** Whether a sync may run: the field is configured in the source and has the same structure. */
export function syncBlocker(report) {
  if (!report.configured.source) return `"${report.field}" is not configured in the source collection.`
  if (!report.schema.ok) return `Strapi check failed: ${report.schema.problem}.`
  return ''
}

/** The target collection attribute with the field set to the synced config. */
export function applyFieldSync(targetCollection, field, sourceField) {
  const targetFields = targetCollection.fields || {}
  const { config } = syncedFieldConfig(sourceField, targetFields, targetFields[field])
  return { ...targetCollection, fields: { ...targetFields, [field]: config } }
}

function formatValue(value) {
  return value === undefined ? '—' : JSON.stringify(value)
}

/** The check as text lines. */
export function formatReport(report, { from, to }) {
  const lines = [`Field "${report.field}": ${from} → ${to}`]
  const schemaState = report.schema.ok ? 'same structure' : `MISMATCH (${report.schema.problem})`
  lines.push(`  Strapi:  ${schemaState} — source: ${report.schema.source}; target: ${report.schema.target}`)
  lines.push(`  Viewer:  configured in source: ${report.configured.source ? 'yes' : 'no'}; in target: ${report.configured.target ? 'yes' : 'no'}`)
  if (report.identical) lines.push('  Config:  identical (order ignored)')
  else if (report.configured.source && report.configured.target) {
    lines.push(`  Config:  ${report.differences.length} difference(s) (target vs. source):`)
    report.differences.forEach(({ path, expected, actual }) => {
      lines.push(`    ${path}: ${formatValue(actual)} → ${formatValue(expected)}`)
    })
  } else if (report.configured.source) lines.push('  Config:  missing in target; sync would add it')
  report.notes.forEach((note) => lines.push(`  Note:    ${note}`))
  return lines
}
