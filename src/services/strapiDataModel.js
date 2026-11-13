// The fields of the online collection's data model, so the configuration can offer them for adding.
// First choice is the content-type schema (all attributes with their Strapi type); it needs the
// role permission "Content-type-builder: getContentTypes". Without it, one sample item is read and
// its keys are taken; that finds scalar fields (Strapi returns them even when null) and, with
// `populate=*`, relations, media and components.
import { strapiFetchJson } from './strapiApi'
import { isPlainObject } from '../domain/objects'

const CONTENT_TYPES_PATH = '/api/content-type-builder/content-types'
const COMPONENTS_PATH = '/api/content-type-builder/components'

// Managed by Strapi itself, never configured as viewer fields.
const SYSTEM_ATTRIBUTE_KEYS = new Set([
  'id',
  'documentId',
  'createdAt',
  'updatedAt',
  'publishedAt',
  'createdBy',
  'updatedBy',
  'locale',
  'localizations',
])

// Strapi attribute type -> viewer field type proposed when the field is added.
const VIEWER_TYPE_BY_STRAPI_TYPE = {
  text: 'text',
  richtext: 'text',
  integer: 'integer',
  biginteger: 'integer',
  boolean: 'checkbox',
}

// Values the viewer's text fields cannot edit as plain values.
const STRUCTURED_STRAPI_TYPES = new Set(['relation', 'media', 'component', 'dynamiczone', 'json', 'blocks'])

function lastPathSegment(itemsPath) {
  const path = String(itemsPath || '').split('#')[0].split('?')[0]
  const segments = path.split('/').filter(Boolean)
  return segments[segments.length - 1] || ''
}

function toFieldEntry(key, strapiType) {
  return {
    key,
    strapiType,
    suggestedType: VIEWER_TYPE_BY_STRAPI_TYPE[strapiType] || 'normal',
    isStructured: STRUCTURED_STRAPI_TYPES.has(strapiType),
  }
}

// A schema attribute as a field entry; components also keep their UID and `repeatable`, so two
// component fields can be compared.
function toSchemaFieldEntry(key, attribute) {
  const entry = toFieldEntry(key, String(attribute?.type || ''))
  if (entry.strapiType !== 'component') return entry
  return { ...entry, component: String(attribute.component || ''), repeatable: attribute.repeatable === true }
}

function isUserField(key) {
  return Boolean(key) && !SYSTEM_ATTRIBUTE_KEYS.has(key)
}

function findContentType(payload, itemsPath) {
  const pluralName = lastPathSegment(itemsPath)
  const contentTypes = Array.isArray(payload?.data) ? payload.data : []
  return contentTypes.find((entry) => entry?.schema?.pluralName === pluralName) || null
}

/** The fields of the content type whose plural name matches the last segment of `itemsPath`. */
export function extractFieldModelFromContentTypes(payload, itemsPath) {
  const attributes = findContentType(payload, itemsPath)?.schema?.attributes
  if (!isPlainObject(attributes)) return null

  return Object.entries(attributes)
    .filter(([key]) => isUserField(key))
    .map(([key, attribute]) => toSchemaFieldEntry(key, attribute))
}

/** The attributes of every component, by UID (`{ 'shared.person': { name: { type }, … } }`). */
export function extractComponentSchemas(payload) {
  const components = Array.isArray(payload?.data) ? payload.data : []
  const schemas = {}
  components.forEach((entry) => {
    const attributes = entry?.schema?.attributes
    if (entry?.uid && isPlainObject(attributes)) schemas[entry.uid] = attributes
  })
  return schemas
}

/** Like extractComponentSchemas, read from Strapi; `{}` when the role may not read the schema. */
export async function fetchComponentSchemasFromStrapi({ profile, token = '' }) {
  try {
    const payload = await strapiFetchJson({ profile, token, path: COMPONENTS_PATH })
    return extractComponentSchemas(payload)
  } catch {
    return {}
  }
}

function inferStrapiTypeFromValue(value) {
  if (typeof value === 'boolean') return 'boolean'
  if (Number.isInteger(value)) return 'integer'
  if (typeof value === 'number') return 'decimal'
  if (Array.isArray(value) || isPlainObject(value)) return 'json'
  return ''
}

/** The fields of one sample item; types are guessed from the values (unknown for null). */
export function extractFieldModelFromSampleRow(row) {
  const source = isPlainObject(row?.attributes) ? row.attributes : row
  if (!isPlainObject(source)) return []

  return Object.entries(source)
    .filter(([key]) => isUserField(key))
    .map(([key, value]) => toFieldEntry(key, inferStrapiTypeFromValue(value)))
}

function buildSamplePath(itemsPath, withPopulate) {
  const separator = itemsPath.includes('?') ? '&' : '?'
  const populate = withPopulate ? '&populate=*' : ''
  return `${itemsPath}${separator}pagination[pageSize]=1${populate}`
}

async function fetchSampleRow({ profile, token, itemsPath }) {
  let payload
  try {
    payload = await strapiFetchJson({ profile, token, path: buildSamplePath(itemsPath, true) })
  } catch {
    // populate=* fails when the role may not read a related collection; the scalars still help.
    payload = await strapiFetchJson({ profile, token, path: buildSamplePath(itemsPath, false) })
  }
  return Array.isArray(payload?.data) ? payload.data[0] || null : null
}

/** The project's own collection types as `{ path: '/api/<pluralName>', name }`, sorted by name. */
export function extractCollectionTypes(payload) {
  const contentTypes = Array.isArray(payload?.data) ? payload.data : []
  return contentTypes
    .filter((entry) => String(entry?.uid || '').startsWith('api::'))
    .filter((entry) => entry?.schema?.kind === 'collectionType' && entry.schema.pluralName)
    .map((entry) => ({
      path: `/api/${entry.schema.pluralName}`,
      name: String(entry.schema.displayName || entry.schema.pluralName),
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

/** The collection types a rule can target; `[]` when the role may not read the schema. */
export async function fetchCollectionTypesFromStrapi({ profile, token = '' }) {
  try {
    const payload = await strapiFetchJson({ profile, token, path: CONTENT_TYPES_PATH })
    return extractCollectionTypes(payload)
  } catch {
    return []
  }
}

/**
 * Resolves the field model of the collection behind `itemsPath`.
 * Returns `{ source: 'schema' | 'sample', fields: [{ key, strapiType, suggestedType, isStructured }] }`;
 * `source: 'sample'` with no fields means the collection is empty and the schema was not readable.
 */
export async function fetchCollectionFieldModelFromStrapi({ profile, token = '', itemsPath }) {
  try {
    const payload = await strapiFetchJson({ profile, token, path: CONTENT_TYPES_PATH })
    const fields = extractFieldModelFromContentTypes(payload, itemsPath)
    if (fields) return { source: 'schema', fields }
  } catch {
    // Schema not readable for this role: fall back to a sample item below.
  }

  const row = await fetchSampleRow({ profile, token, itemsPath })
  return { source: 'sample', fields: extractFieldModelFromSampleRow(row) }
}

/**
 * The relation attribute of the collection behind `fromItemsPath` that points to the collection
 * behind `toItemsPath`; '' when there is none (or several would need a choice: the first wins).
 */
export function extractRelationAttribute(payload, { fromItemsPath, toItemsPath }) {
  const targetUid = findContentType(payload, toItemsPath)?.uid
  const attributes = findContentType(payload, fromItemsPath)?.schema?.attributes
  if (!targetUid || !isPlainObject(attributes)) return ''

  const match = Object.entries(attributes).find(
    ([, attribute]) => attribute?.type === 'relation' && attribute.target === targetUid,
  )
  return match ? match[0] : ''
}

/** Like extractRelationAttribute, read from the schema; '' when the role may not read it. */
export async function fetchRelationAttributeFromStrapi({ profile, token = '', fromItemsPath, toItemsPath }) {
  try {
    const payload = await strapiFetchJson({ profile, token, path: CONTENT_TYPES_PATH })
    return extractRelationAttribute(payload, { fromItemsPath, toItemsPath })
  } catch {
    return ''
  }
}
