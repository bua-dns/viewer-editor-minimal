// Two layouts of the Strapi viewer-settings record (`data` of GET <configPath>):
//
// v1  one collection per record: `settings` (field config, itemsPath, …) and `replacements`.
// v2  one JSON attribute per collection (`index_cards`, `collection_items`, …). Each holds what v1
//     keeps in `settings` plus that collection's `replacements` and optional `relations`. The
//     deployment's basic config names the primary collection and the secondary ones.
//
// The rest of the app keeps working on the v1 shape: in v2 the primary collection's attribute is
// handed on as `settings`.

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

export const LAYOUT_V1 = 'v1'
export const LAYOUT_V2 = 'v2'

/** Keys of a collection attribute that are not part of its field configuration. */
const NON_SETTINGS_KEYS = ['replacements']

/** A collection attribute as v1-shaped settings: without replacements and without `omitKeys`. */
export function collectionConfigToSettings(config, omitKeys = []) {
  const settings = { ...(isPlainObject(config) ? config : {}) }
  ;[...NON_SETTINGS_KEYS, ...omitKeys].forEach((key) => delete settings[key])
  return settings
}

function resolveV1Replacements(data) {
  if (isPlainObject(data?.replacements)) return data.replacements
  if (isPlainObject(data?.settings?.replacements)) return data.settings.replacements
  return {}
}

function readV1Layout(data) {
  if (!isPlainObject(data?.settings)) {
    throw new Error('Config response must contain an object at data.settings.')
  }
  return {
    layout: LAYOUT_V1,
    primaryId: '',
    settings: data.settings,
    replacements: resolveV1Replacements(data),
    secondaries: [],
  }
}

function readSecondary(data, id) {
  const config = data?.[id]
  if (!isPlainObject(config)) {
    return { id, config: null, error: `The viewer settings have no JSON attribute "${id}".` }
  }
  return { id, config, error: '' }
}

function readV2Layout(data, { primaryCollection, secondaryCollections, omitKeys }) {
  const primaryConfig = data?.[primaryCollection]
  if (!isPlainObject(primaryConfig)) {
    throw new Error(
      `The viewer settings have no JSON attribute "${primaryCollection}" (primaryCollection of the basic config).`,
    )
  }
  return {
    layout: LAYOUT_V2,
    primaryId: primaryCollection,
    settings: collectionConfigToSettings(primaryConfig, omitKeys),
    replacements: isPlainObject(primaryConfig.replacements) ? primaryConfig.replacements : {},
    secondaries: secondaryCollections.map((id) => readSecondary(data, id)),
  }
}

/**
 * Reads the record in the layout the basic config asks for. Without `primaryCollection` it is v1.
 * `omitKeys`: keys dropped from v2 settings (the viewer settings, which v2 keeps in the basic config).
 * Throws when the record lacks what that layout needs.
 */
export function readViewerSettingsLayout(data, { primaryCollection = '', secondaryCollections = [], omitKeys = [] } = {}) {
  if (!primaryCollection) return readV1Layout(data)
  return readV2Layout(data, { primaryCollection, secondaryCollections, omitKeys })
}

/** The attribute after `Konfiguration anwenden`: new settings, replacements and relations kept. */
export function mergeSettingsIntoCollectionConfig(current, settings, omitKeys = []) {
  const base = isPlainObject(current) ? current : {}
  const next = { ...base, ...collectionConfigToSettings(settings, omitKeys) }
  omitKeys.forEach((key) => delete next[key])
  if (isPlainObject(base.replacements)) next.replacements = base.replacements
  return next
}

/** The attribute after saving replacement rules: everything else kept. */
export function mergeReplacementsIntoCollectionConfig(current, replacements) {
  return { ...(isPlainObject(current) ? current : {}), replacements }
}

/**
 * The settings written by `Konfiguration anwenden`: the stored ones with the edited field config
 * on top. `viewerSettingKeys` are dropped and `viewerOverrides` put back, so a viewer setting
 * without override is removed. Keys the viewer does not edit (itemsPath, scanField, …) stay.
 */
export function mergeOnlineSettings(storedSettings, userConfigPayload, { viewerSettingKeys = [], viewerOverrides = {} } = {}) {
  const merged = { ...(isPlainObject(storedSettings) ? storedSettings : {}), ...userConfigPayload }
  viewerSettingKeys.forEach((key) => delete merged[key])
  return { ...merged, ...viewerOverrides }
}
