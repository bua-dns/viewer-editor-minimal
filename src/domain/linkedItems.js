// Pure helpers for items of a secondary collection shown under the selected primary item.
import { createDefaultValueForFieldType, normalizeValueForConfiguredType } from '../fields/fieldRegistry'
import { isPlainObject } from './objects'

const ONLINE_META_KEY = '__onlineMeta'

/** Configuration scope of a secondary collection in useUserConfigStore. */
export function secondaryConfigScope(collectionId) {
  return `secondary:${collectionId}`
}

/** `{ id, idKind }` of a saved online item; null for drafts and offline items. */
export function resolveLinkTarget(item) {
  const meta = item?.[ONLINE_META_KEY]
  const isSaved = isPlainObject(meta) && meta.isDraft !== true
  if (!isSaved || !meta.id) return null
  return { id: meta.id, idKind: meta.idKind === 'id' ? 'id' : 'documentId' }
}

/** Key of a linked item within its collection (`itemsPath::id`). */
export function linkedItemKey(item) {
  const meta = item?.[ONLINE_META_KEY]
  return isPlainObject(meta) ? `${meta.itemsPath}::${meta.id}` : ''
}

/** Adds the configured fields an item lacks (with their defaults) and normalizes the values. */
export function prepareLinkedItem(item, fieldConfigs = {}) {
  Object.entries(isPlainObject(fieldConfigs) ? fieldConfigs : {}).forEach(([key, config]) => {
    const value = Object.prototype.hasOwnProperty.call(item, key) ? item[key] : createDefaultValueForFieldType(config?.type)
    item[key] = normalizeValueForConfiguredType(config?.type, value)
  })
  return item
}

/** Header of a collapsible: the label field's value, else the item's id. */
export function describeLinkedItem(item, labelField) {
  const value = labelField ? item?.[labelField] : ''
  const text = typeof value === 'string' || typeof value === 'number' ? String(value).trim() : ''
  return text || String(item?.[ONLINE_META_KEY]?.id || '')
}

/** A language map (`{ de, en }`) in `language`, else the first entry; '' for anything else. */
export function pickLanguageText(map, language) {
  if (!isPlainObject(map)) return ''
  return String(map[language] || map.de || map.en || Object.values(map)[0] || '')
}
