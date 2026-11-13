// Strapi calls for the collection layout (v2, see viewerSettingsLayout.js): the raw viewer-settings
// record, writing one collection attribute, and loading the items linked to a primary item.
import { buildPathWithAdditionalQueryParams, strapiFetchJson } from './strapiApi'
import { isPlainObject } from '../domain/objects'

/** Upper bound of linked items loaded per primary item and collection. */
export const LINKED_ITEMS_PAGE_SIZE = 100

/** `data` of GET <configPath>, unchecked beyond being an object. */
export async function fetchViewerSettingsRecordFromStrapi({ profile, token = '' }) {
  const payload = await strapiFetchJson({ profile, path: profile.configPath, method: 'GET', token })
  if (!isPlainObject(payload?.data)) {
    throw new Error('Config response must contain an object at data.')
  }
  return payload.data
}

/**
 * Writes one collection attribute. The attribute is read fresh first and `update(current)` builds
 * the new value from it, so changes saved meanwhile (e.g. replacements from another deployment)
 * are kept. Other attributes are not sent and stay as they are.
 */
export async function updateCollectionConfigInStrapi({ profile, token = '', collectionId, update }) {
  const record = await fetchViewerSettingsRecordFromStrapi({ profile, token })
  const current = record[collectionId]
  if (!isPlainObject(current)) {
    throw new Error(`The viewer settings have no JSON attribute "${collectionId}".`)
  }

  const payload = await strapiFetchJson({
    profile,
    path: profile.configPath,
    method: 'PUT',
    token,
    body: { data: { [collectionId]: update(current) } },
  })
  const config = payload?.data?.[collectionId]
  if (!isPlainObject(config)) {
    throw new Error(`Config update response must contain an object at data.${collectionId}.`)
  }
  return { payload, config }
}

/**
 * Path that lists the items of `itemsPath` whose relation `relationAttribute` contains the item
 * `{ id, idKind }` (idKind 'documentId' in Strapi 5, 'id' in Strapi 4).
 */
export function buildLinkedItemsPath({ itemsPath, relationAttribute, linkedTo, populateFields = [] }) {
  const idKind = linkedTo.idKind === 'id' ? 'id' : 'documentId'
  const entries = [
    [`filters[${relationAttribute}][${idKind}][$eq]`, linkedTo.id],
    ['pagination[pageSize]', LINKED_ITEMS_PAGE_SIZE],
    ['sort[0]', 'id:asc'],
    ...Array.from(new Set(populateFields)).filter(Boolean).map((field, index) => [`populate[${index}]`, field]),
  ]
  return buildPathWithAdditionalQueryParams(itemsPath, entries)
}

/** The raw rows linked to one primary item. */
export async function fetchLinkedItemsFromStrapi({ profile, token = '', itemsPath, relationAttribute, linkedTo, populateFields }) {
  const payload = await strapiFetchJson({
    profile,
    token,
    method: 'GET',
    path: buildLinkedItemsPath({ itemsPath, relationAttribute, linkedTo, populateFields }),
  })
  return Array.isArray(payload?.data) ? payload.data : []
}

function buildItemPath(itemsPath, id) {
  const path = String(itemsPath || '').split('?')[0].replace(/\/+$/, '')
  return `${path}/${encodeURIComponent(String(id))}`
}

function toRelationTarget(linkedTo) {
  return linkedTo.idKind === 'id' ? { id: linkedTo.id } : { documentId: linkedTo.id }
}

/**
 * Removes only the link between item `id` and the item `linkedTo` from the relation
 * `relationAttribute`; the item and its other links stay.
 */
export async function unlinkItemInStrapi({ profile, token = '', itemsPath, id, relationAttribute, linkedTo }) {
  return strapiFetchJson({
    profile,
    token,
    method: 'PUT',
    path: buildItemPath(itemsPath, id),
    body: { data: { [relationAttribute]: { disconnect: [toRelationTarget(linkedTo)] } } },
  })
}

/** Deletes item `id` for good (with Draft & Publish: every version of the document). */
export async function deleteItemInStrapi({ profile, token = '', itemsPath, id }) {
  return strapiFetchJson({ profile, token, method: 'DELETE', path: buildItemPath(itemsPath, id) })
}
