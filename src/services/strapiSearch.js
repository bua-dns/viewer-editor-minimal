// Collection-wide text search with plain Strapi filters (`$containsi`), no server extension needed.
import { fetchAllCollectionItemsFromStrapi, parseInvalidStrapiQueryKey } from './strapiApi'

// Field types whose values are plain strings in Strapi. A field without a type counts as `normal`
// (the registry's fallback). Wikidata fields are relations/components and are not searched.
const TEXT_FIELD_TYPES = new Set(['normal', 'text', 'candidate'])

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function isTextFieldConfig(fieldConfig) {
  const type = String(fieldConfig?.type ?? '').trim()
  return !type || TEXT_FIELD_TYPES.has(type)
}

/** The configured text fields plus the hierarchy fields, in that order, without duplicates. */
export function resolveSearchableFieldKeys(settings, hierarchyFields = []) {
  const fields = isPlainObject(settings?.fields) ? settings.fields : {}
  const textFieldKeys = Object.entries(fields)
    .filter(([, fieldConfig]) => isTextFieldConfig(fieldConfig))
    .map(([fieldKey]) => fieldKey)
  const keys = [...textFieldKeys, ...(Array.isArray(hierarchyFields) ? hierarchyFields : [])]
    .map((fieldKey) => String(fieldKey || '').trim())
    .filter(Boolean)
  return Array.from(new Set(keys))
}

/**
 * Every token must occur in at least one of the fields (AND over tokens, OR over fields), the same
 * semantics as the local search: `filters[$and][t][$or][f][<field>][$containsi]=<token>`.
 */
export function buildContainsFilterEntries(tokens, fieldKeys) {
  const entries = []
  tokens.forEach((token, tokenIndex) => {
    fieldKeys.forEach((fieldKey, fieldIndex) => {
      entries.push([`filters[$and][${tokenIndex}][$or][${fieldIndex}][${fieldKey}][$containsi]`, token])
    })
  })
  return entries
}

function createSearchError(message) {
  const error = new Error(message)
  error.status = 400
  return error
}

/**
 * Loads every item matching all `tokens`. When Strapi rejects one of the search fields as an invalid
 * key (not filterable in the data model), that field is dropped and the search runs again; every
 * retry removes one field, so there are at most `fieldKeys.length` attempts.
 * Returns `{ rows, searchedFieldKeys, droppedFieldKeys }`.
 */
export async function searchCollectionItemsInStrapi({ profile, itemsPath, token = '', populateFields = [], tokens, fieldKeys }) {
  let remaining = [...fieldKeys]
  const droppedFieldKeys = []

  while (remaining.length > 0) {
    try {
      const rows = await fetchAllCollectionItemsFromStrapi({
        profile,
        itemsPath,
        token,
        populateFields,
        extraFilterEntries: buildContainsFilterEntries(tokens, remaining),
      })
      return { rows, searchedFieldKeys: remaining, droppedFieldKeys }
    } catch (error) {
      const invalidKey = parseInvalidStrapiQueryKey(error)
      if (!invalidKey || !remaining.includes(invalidKey)) throw error
      droppedFieldKeys.push(invalidKey)
      remaining = remaining.filter((fieldKey) => fieldKey !== invalidKey)
    }
  }

  throw createSearchError('None of the configured fields can be searched on the server.')
}
