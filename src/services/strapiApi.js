import { joinBaseUrlAndPath } from '../composables/connectionProfile'

const ONLINE_META_KEY = '__onlineMeta'

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

async function parseJsonResponseSafe(response) {
  try {
    return await response.json()
  } catch {
    return null
  }
}

function createHttpError(message, status, payload) {
  const error = new Error(message)
  error.status = status
  error.payload = payload
  return error
}

export const READ_TIMEOUT_MS = 30_000
export const WRITE_TIMEOUT_MS = 60_000

let unauthorizedHandler = null

/** Called with the error whenever a request that carried a token is answered with 401. */
export function setUnauthorizedHandler(handler) {
  unauthorizedHandler = typeof handler === 'function' ? handler : null
}

function buildRequestSignal(signal, timeoutMs) {
  const timeoutSignal = AbortSignal.timeout(timeoutMs)
  if (!signal) return timeoutSignal
  return AbortSignal.any([signal, timeoutSignal])
}

/**
 * A timeout or a network failure leaves the outcome open: a write may have reached the server.
 * `outcomeUnknown` marks that case for callers that must not simply repeat a create.
 */
function toTransportError(error, timeoutMs) {
  if (error?.name === 'AbortError') return error
  const isTimeout = error?.name === 'TimeoutError'
  const message = isTimeout
    ? `No answer from the server within ${Math.round(timeoutMs / 1000)} s.`
    : 'The server could not be reached.'
  const transportError = createHttpError(message, 0, null)
  transportError.cause = error
  transportError.outcomeUnknown = true
  return transportError
}

function buildRequestHeaders(token, hasBody) {
  const headers = { Accept: 'application/json' }
  if (hasBody) headers['Content-Type'] = 'application/json'
  if (token) headers.Authorization = `Bearer ${token}`
  return headers
}

function readBackendErrorMessage(payload, status) {
  return payload?.error?.message || payload?.message || `Request failed with HTTP ${status}.`
}

export async function strapiFetchJson({
  profile,
  path,
  method = 'GET',
  token = '',
  body = undefined,
  signal = undefined,
  timeoutMs = method === 'GET' ? READ_TIMEOUT_MS : WRITE_TIMEOUT_MS,
}) {
  const requestUrl = joinBaseUrlAndPath(profile.baseUrl, path)

  let response
  try {
    response = await fetch(requestUrl, {
      method,
      headers: buildRequestHeaders(token, body !== undefined),
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: buildRequestSignal(signal, timeoutMs),
    })
  } catch (error) {
    throw toTransportError(error, timeoutMs)
  }

  const payload = await parseJsonResponseSafe(response)

  if (!response.ok) {
    const httpError = createHttpError(readBackendErrorMessage(payload, response.status), response.status, payload)
    if (response.status === 401 && token && unauthorizedHandler) unauthorizedHandler(httpError)
    throw httpError
  }

  // A 2xx without a JSON body is usually a proxy or SPA fallback page, not Strapi (204 = no body).
  if (payload === null && response.status !== 204) {
    throw createHttpError(`The answer from ${path} is not JSON (HTTP ${response.status}).`, response.status, null)
  }

  return payload
}

export async function loginWithStrapi({ profile, identifier, password }) {
  const payload = await strapiFetchJson({
    profile,
    path: '/api/auth/local',
    method: 'POST',
    body: { identifier, password },
  })

  if (!payload || typeof payload.jwt !== 'string' || !payload.jwt) {
    throw createHttpError('Login response does not contain a valid JWT.', 500, payload)
  }

  return {
    jwt: payload.jwt,
    user: isPlainObject(payload.user) ? payload.user : null,
  }
}

export async function fetchCurrentUserFromStrapi({ profile, token }) {
  return strapiFetchJson({
    profile,
    path: '/api/users/me',
    method: 'GET',
    token,
  })
}

export async function fetchViewerSettingsFromStrapi({ profile, token = '' }) {
  const payload = await strapiFetchJson({
    profile,
    path: profile.configPath,
    method: 'GET',
    token,
  })

  const settings = payload?.data?.settings
  if (!isPlainObject(settings)) {
    throw createHttpError('Config response must contain an object at data.settings.', 500, payload)
  }

  const wording = isPlainObject(payload?.data?.wording) ? payload.data.wording : {}
  const replacements = resolveReplacementsFromConfigPayload(payload)

  return {
    payload,
    settings,
    wording,
    replacements,
  }
}

/**
 * Replacement rules live in their own prop of the viewer-settings singleton
 * (`data.replacements`); older instances kept them inside the settings object.
 */
function resolveReplacementsFromConfigPayload(payload) {
  if (isPlainObject(payload?.data?.replacements)) return payload.data.replacements
  if (isPlainObject(payload?.data?.settings?.replacements)) return payload.data.settings.replacements
  return {}
}

export async function updateViewerReplacementsInStrapi({ profile, token = '', replacements }) {
  if (!isPlainObject(replacements)) {
    throw createHttpError('Updated replacements must be an object.', 400, replacements)
  }

  const payload = await strapiFetchJson({
    profile,
    path: profile.configPath,
    method: 'PUT',
    token,
    body: {
      data: {
        replacements,
      },
    },
  })

  if (!isPlainObject(payload?.data?.replacements)) {
    throw createHttpError(
      'Config update response must contain an object at data.replacements. Does the viewer settings type have a JSON prop named "replacements"?',
      500,
      payload,
    )
  }

  return {
    payload,
    replacements: payload.data.replacements,
  }
}

export async function updateViewerSettingsInStrapi({ profile, token = '', settings }) {
  if (!isPlainObject(settings)) {
    throw createHttpError('Updated viewer settings must be an object.', 400, settings)
  }

  const payload = await strapiFetchJson({
    profile,
    path: profile.configPath,
    method: 'PUT',
    token,
    body: {
      data: {
        settings,
      },
    },
  })

  const updatedSettings = payload?.data?.settings
  if (!isPlainObject(updatedSettings)) {
    throw createHttpError('Config update response must contain an object at data.settings.', 500, payload)
  }

  const wording = isPlainObject(payload?.data?.wording) ? payload.data.wording : {}

  return {
    payload,
    settings: updatedSettings,
    wording,
    replacements: resolveReplacementsFromConfigPayload(payload),
  }
}

const DEFAULT_SCAN_FIELD_KEY = 'scan'

export function resolveScanFieldFromSettings(settings = {}) {
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) return DEFAULT_SCAN_FIELD_KEY

  const scanField = String(settings.scanField || '').trim()
  if (scanField) return scanField

  const legacyScanField = String(settings.scan_field || '').trim()
  if (legacyScanField) return legacyScanField

  return DEFAULT_SCAN_FIELD_KEY
}

export function resolveItemsPathFromSettings(settings = {}) {
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) return ''

  const itemsPath = String(settings.itemsPath || '').trim()
  if (itemsPath) return itemsPath

  const legacyItemsPath = String(settings.item_path || '').trim()
  if (legacyItemsPath) return legacyItemsPath

  return ''
}

/**
 * Optional text field of the collection that receives a client-generated key on create, so a
 * create whose answer was lost can be found instead of being sent twice. '' = not configured.
 */
export function resolveCreateKeyFieldFromSettings(settings = {}) {
  if (!isPlainObject(settings)) return ''
  return String(settings.createKeyField || '').trim()
}

/** The first row whose `fieldKey` equals `value`, or null. */
export async function findCollectionItemByFieldValue({ profile, itemsPath, token = '', fieldKey, value }) {
  const payload = await strapiFetchJson({
    profile,
    path: buildItemsPathWithPopulate(itemsPath, { page: 1, pageSize: 1, filtersEq: { [fieldKey]: value } }),
    method: 'GET',
    token,
  })
  const rows = Array.isArray(payload?.data) ? payload.data : []
  return rows[0] || null
}

function buildPathWithAdditionalQueryParams(path, entries = []) {
  const normalizedPath = String(path || '').split('#')[0]
  const [basePath, existingQuery = ''] = normalizedPath.split('?')
  const query = new URLSearchParams(existingQuery)

  for (const [key, rawValue] of entries) {
    const normalizedKey = String(key || '').trim()
    if (!normalizedKey) continue
    query.append(normalizedKey, String(rawValue ?? ''))
  }

  const queryString = query.toString()
  return queryString ? `${basePath}?${queryString}` : basePath
}

function isWikidataAutosuggestType(type) {
  const normalized = String(type || '').trim().toLowerCase()
  return normalized === 'wikidata-autosuggest' || normalized === 'wikidata_autosuggest'
}

function normalizeWikidataEntityFromStrapi(entity) {
  if (!isPlainObject(entity)) return entity

  const wikidataId =
    typeof entity.wikidata_id === 'string' && entity.wikidata_id.trim().length
      ? entity.wikidata_id.trim()
      : typeof entity.id === 'string' && entity.id.trim().length
        ? entity.id.trim()
        : ''

  if (!wikidataId) {
    return entity
  }

  const additionalData = isPlainObject(entity.additional_data) ? entity.additional_data : {}
  const mergedEntity = {
    ...additionalData,
    ...entity,
    id: wikidataId,
  }

  delete mergedEntity.wikidata_id
  delete mergedEntity.additional_data
  return mergedEntity
}

function normalizeWikidataEntityForStrapi(entity) {
  if (!isPlainObject(entity)) return entity

  const viewerId = typeof entity.id === 'string' ? entity.id.trim() : ''
  const wikidataId =
    typeof entity.wikidata_id === 'string' && entity.wikidata_id.trim().length
      ? entity.wikidata_id.trim()
      : viewerId

  if (!wikidataId) {
    return entity
  }

  const nextEntity = {
    wikidata_id: wikidataId,
    label: entity.label,
    description: entity.description,
  }

  const additionalData = isPlainObject(entity.additional_data) ? { ...entity.additional_data } : {}
  Object.entries(entity).forEach(([key, value]) => {
    if (key === 'id' || key === 'wikidata_id' || key === 'label' || key === 'description') {
      return
    }
    additionalData[key] = value
  })

  if (Object.keys(additionalData).length) {
    nextEntity.additional_data = additionalData
  }

  return nextEntity
}

function normalizeOnlineFieldValueFromStrapi(value, fieldConfig) {
  if (!isWikidataAutosuggestType(fieldConfig?.type)) {
    return value
  }

  if (!Array.isArray(value)) {
    return value
  }

  return value.map((entity) => normalizeWikidataEntityFromStrapi(entity))
}

function normalizeOnlineFieldValueForStrapi(value, fieldConfig) {
  if (!isWikidataAutosuggestType(fieldConfig?.type)) {
    return value
  }

  if (!Array.isArray(value)) {
    return value
  }

  return value.map((entity) => normalizeWikidataEntityForStrapi(entity))
}

function parseInvalidStrapiQueryKey(error) {
  const message = String(error?.message || '').trim()
  const match = message.match(/invalid key\s+([A-Za-z0-9_\-]+)/i)
  if (!match) return ''
  return String(match[1] || '').trim()
}

export function getWikidataAutosuggestFieldKeysFromSettings(settings = {}) {
  const fields = settings?.fields
  if (!isPlainObject(fields)) {
    return []
  }

  return Object.entries(fields)
    .filter(([, fieldConfig]) => isWikidataAutosuggestType(fieldConfig?.type))
    .map(([fieldKey]) => String(fieldKey || '').trim())
    .filter(Boolean)
}

export function normalizeOnlineChangedFieldsForStrapi(changedFields = {}, fieldConfigs = {}) {
  if (!isPlainObject(changedFields)) {
    return {}
  }

  const normalizedFieldConfigs = isPlainObject(fieldConfigs) ? fieldConfigs : {}
  const nextFields = {}

  Object.entries(changedFields).forEach(([fieldKey, value]) => {
    const fieldConfig = normalizedFieldConfigs[fieldKey]
    nextFields[fieldKey] = normalizeOnlineFieldValueForStrapi(value, fieldConfig)
  })

  return nextFields
}

export function buildItemsPathWithPopulate(
  itemsPath,
  { page = 1, pageSize = 100, populateFields = [], fieldKeys = [], filtersEq = {}, filterEmptyField = '' } = {},
) {
  const queryEntries = [
    ['pagination[page]', page],
    ['pagination[pageSize]', pageSize],
  ]

  const normalizedPopulateFields = Array.from(
    new Set(
      (Array.isArray(populateFields) ? populateFields : [])
        .map((fieldName) => String(fieldName || '').trim())
        .filter(Boolean),
    ),
  )

  normalizedPopulateFields.forEach((fieldName, index) => {
    queryEntries.push([`populate[${index}]`, fieldName])
  })

  const normalizedFieldKeys = Array.from(
    new Set(
      (Array.isArray(fieldKeys) ? fieldKeys : [])
        .map((fieldName) => String(fieldName || '').trim())
        .filter(Boolean),
    ),
  )

  normalizedFieldKeys.forEach((fieldName, index) => {
    queryEntries.push([`fields[${index}]`, fieldName])
  })

  queryEntries.push(...buildEqualityFilterEntries(filtersEq))
  queryEntries.push(...buildEmptyValueFilterEntries(filterEmptyField))

  return buildPathWithAdditionalQueryParams(itemsPath, queryEntries)
}

function buildEqualityFilterEntries(filtersEq) {
  if (!isPlainObject(filtersEq)) return []
  return Object.entries(filtersEq)
    .map(([fieldKey, fieldValue]) => [String(fieldKey || '').trim(), fieldValue])
    .filter(([fieldKey]) => fieldKey)
    .map(([fieldKey, fieldValue]) => [`filters[${fieldKey}][$eq]`, fieldValue ?? ''])
}

// Matches items whose field is null or an empty string (the "unassigned" hierarchy group).
function buildEmptyValueFilterEntries(fieldKey) {
  const normalizedFieldKey = String(fieldKey || '').trim()
  if (!normalizedFieldKey) return []
  return [
    [`filters[$or][0][${normalizedFieldKey}][$null]`, 'true'],
    [`filters[$or][1][${normalizedFieldKey}][$eq]`, ''],
  ]
}

/**
 * GETs `buildPath(populateFields)`. When Strapi rejects one of the populate keys (e.g. a field that
 * is not a relation/component), drops that key and tries again. Every retry removes one key, so
 * there are at most `populateFields.length + 1` requests.
 */
async function fetchDroppingInvalidPopulateKeys({ profile, token, populateFields, buildPath }) {
  let remaining = [...populateFields]
  const droppedKeys = []

  for (;;) {
    try {
      const payload = await strapiFetchJson({ profile, path: buildPath(remaining), method: 'GET', token })
      return { payload, populateFields: remaining, droppedKeys }
    } catch (error) {
      const invalidKey = parseInvalidStrapiQueryKey(error)
      if (!invalidKey || !remaining.includes(invalidKey)) throw error
      droppedKeys.push(invalidKey)
      remaining = remaining.filter((fieldName) => fieldName !== invalidKey)
    }
  }
}

export async function fetchAllCollectionItemsFromStrapi({
  profile,
  itemsPath,
  token = '',
  pageSize = 100,
  populateFields = [],
  fieldKeys = [],
  filtersEq = {},
  filterEmptyField = '',
}) {
  const collected = []
  let effectivePopulateFields = Array.from(
    new Set(
      (Array.isArray(populateFields) ? populateFields : [])
        .map((fieldName) => String(fieldName || '').trim())
        .filter(Boolean),
    ),
  )
  let page = 1
  let pageCount = 1

  while (page <= pageCount) {
    const result = await fetchDroppingInvalidPopulateKeys({
      profile,
      token,
      populateFields: effectivePopulateFields,
      buildPath: (populate) =>
        buildItemsPathWithPopulate(itemsPath, { page, pageSize, populateFields: populate, fieldKeys, filtersEq, filterEmptyField }),
    })
    const { payload } = result
    effectivePopulateFields = result.populateFields

    const rows = Array.isArray(payload?.data) ? payload.data : null
    if (!rows) {
      throw createHttpError('Items response must contain an array at data.', 500, payload)
    }

    collected.push(...rows)

    const nextPageCount = Number(payload?.meta?.pagination?.pageCount)
    pageCount = Number.isFinite(nextPageCount) && nextPageCount > 0 ? nextPageCount : 1
    page += 1
  }

  return collected
}

function getStrapiFieldValue(row, fieldKey) {
  if (!isPlainObject(row)) return undefined
  const valueSource = isPlainObject(row.attributes) ? row.attributes : row
  return valueSource?.[fieldKey]
}

export async function fetchCollectionFieldValuesFromStrapi({
  profile,
  itemsPath,
  token = '',
  fieldKey,
  filtersEq = {},
  pageSize = 250,
}) {
  const normalizedFieldKey = String(fieldKey || '').trim()
  if (!normalizedFieldKey) {
    throw createHttpError('Field key is required for collection field value fetch.', 400, { fieldKey })
  }

  const rows = await fetchAllCollectionItemsFromStrapi({
    profile,
    itemsPath,
    token,
    pageSize,
    fieldKeys: [normalizedFieldKey],
    filtersEq,
  })

  return rows.map((row) => getStrapiFieldValue(row, normalizedFieldKey))
}

export async function checkDataModelImplementationInStrapi({ profile, token = '' }) {
  const settingsResult = await fetchViewerSettingsFromStrapi({ profile, token })
  const settings = settingsResult.settings
  const itemsPath = resolveItemsPathFromSettings(settings)

  if (!itemsPath) {
    throw createHttpError('Online settings must provide itemsPath.', 500, settingsResult.payload)
  }

  const wikidataFieldKeys = getWikidataAutosuggestFieldKeysFromSettings(settings)
  const {
    payload,
    populateFields: effectivePopulateFields,
    droppedKeys: droppedPopulateKeys,
  } = await fetchDroppingInvalidPopulateKeys({
    profile,
    token,
    populateFields: wikidataFieldKeys,
    buildPath: (populate) => buildItemsPathWithPopulate(itemsPath, { page: 1, pageSize: 1, populateFields: populate }),
  })

  const probePath = buildItemsPathWithPopulate(itemsPath, {
    page: 1,
    pageSize: 1,
    populateFields: effectivePopulateFields,
  })

  const rows = Array.isArray(payload?.data) ? payload.data : null
  if (!rows) {
    throw createHttpError('Items response must contain an array at data.', 500, payload)
  }

  const firstRow = rows[0] || null
  const valueSource = isPlainObject(firstRow?.attributes) ? firstRow.attributes : firstRow
  const checks = wikidataFieldKeys.map((fieldKey) => {
    if (!isPlainObject(valueSource) || !Object.prototype.hasOwnProperty.call(valueSource, fieldKey)) {
      return {
        fieldKey,
        status: 'error',
        message: `Missing field \"${fieldKey}\" in items payload.`,
      }
    }

    const fieldValue = valueSource[fieldKey]
    if (!Array.isArray(fieldValue)) {
      return {
        fieldKey,
        status: 'error',
        message: `Field \"${fieldKey}\" must be an array.`,
      }
    }

    if (!fieldValue.length) {
      return {
        fieldKey,
        status: 'warning',
        message: `Field \"${fieldKey}\" is an empty array, no entity shape could be verified.`,
      }
    }

    const firstEntity = fieldValue.find((entry) => isPlainObject(entry))
    if (!firstEntity) {
      return {
        fieldKey,
        status: 'error',
        message: `Field \"${fieldKey}\" entries must be objects.`,
      }
    }

    const hasViewerId = typeof firstEntity.id === 'string' && firstEntity.id.trim().length > 0
    const hasViewerLabel = typeof firstEntity.label === 'string' && firstEntity.label.trim().length > 0
    const hasStrapiWikidataId =
      typeof firstEntity.wikidata_id === 'string' && firstEntity.wikidata_id.trim().length > 0

    if (hasViewerId && hasViewerLabel) {
      return {
        fieldKey,
        status: 'ok',
        message: `Field \"${fieldKey}\" matches viewer shape (id + label).`,
      }
    }

    if (hasStrapiWikidataId) {
      return {
        fieldKey,
        status: 'error',
        message: `Field \"${fieldKey}\" uses \"wikidata_id\". Viewer expects \"id\" + \"label\" in each entity.`,
      }
    }

    return {
      fieldKey,
      status: 'error',
      message: `Field \"${fieldKey}\" entities must contain \"id\" and \"label\".`,
    }
  })

  const hasError = checks.some((entry) => entry.status === 'error')
  const hasWarning = checks.some((entry) => entry.status === 'warning') || droppedPopulateKeys.length > 0

  return {
    ok: !hasError,
    status: hasError ? 'error' : hasWarning ? 'warning' : 'ok',
    itemsPath,
    probePath,
    droppedPopulateKeys,
    wikidataFieldKeys,
    checks,
    rowCount: rows.length,
    payload,
  }
}

function stripQueryAndHash(path) {
  return String(path || '').split('#')[0].split('?')[0]
}

function isValidOnlineIdentifier(value) {
  if (typeof value === 'number') return Number.isFinite(value)
  if (typeof value === 'string') return value.trim().length > 0
  return false
}

function resolveStableIdentifier(source) {
  if (!isPlainObject(source)) return null

  if (isValidOnlineIdentifier(source.documentId)) {
    return {
      id: String(source.documentId).trim(),
      idKind: 'documentId',
    }
  }

  if (isValidOnlineIdentifier(source.id)) {
    return {
      id: source.id,
      idKind: 'id',
    }
  }

  return null
}

export function normalizeStrapiItem(
  row,
  settingsFields = {},
  itemsPath = '',
  scanFieldKey = DEFAULT_SCAN_FIELD_KEY,
) {
  const source = isPlainObject(row) ? row : {}
  const attributes = isPlainObject(source.attributes) ? source.attributes : null
  const valueSource = attributes || source

  const stableIdentifier = resolveStableIdentifier(source) || resolveStableIdentifier(valueSource)
  if (!stableIdentifier) {
    throw createHttpError('Online item is missing a stable identifier (documentId or id).', 500, row)
  }

  const nextItem = {}

  const normalizedSettingsFields = isPlainObject(settingsFields)
    ? settingsFields
    : Array.isArray(settingsFields)
      ? Object.fromEntries(settingsFields.map((fieldKey) => [String(fieldKey || '').trim(), {}]))
      : {}

  Object.keys(normalizedSettingsFields).forEach((fieldKey) => {
    if (!fieldKey) return
    if (Object.prototype.hasOwnProperty.call(valueSource, fieldKey)) {
      nextItem[fieldKey] = normalizeOnlineFieldValueFromStrapi(
        valueSource[fieldKey],
        normalizedSettingsFields[fieldKey],
      )
    }
  })

  const normalizedScanFieldKey = String(scanFieldKey || '').trim() || DEFAULT_SCAN_FIELD_KEY
  if (Object.prototype.hasOwnProperty.call(valueSource, normalizedScanFieldKey)) {
    nextItem.scan = valueSource[normalizedScanFieldKey]
  }

  nextItem[ONLINE_META_KEY] = {
    id: stableIdentifier.id,
    idKind: stableIdentifier.idKind,
    idValue: stableIdentifier.id,
    itemsPath: stripQueryAndHash(itemsPath),
    updatedAt: valueSource.updatedAt,
  }

  return nextItem
}

export function buildStrapiUpdatePayload(changedFields = {}) {
  if (!isPlainObject(changedFields)) {
    throw createHttpError('Changed fields payload must be an object.', 400, changedFields)
  }
  return {
    data: changedFields,
  }
}

export async function updateCollectionItemInStrapi({
  profile,
  itemsPath,
  token = '',
  id,
  changedFields,
  method = 'PUT',
}) {
  const itemPath = buildItemPath(itemsPath, id, 'update')
  const payload = buildStrapiUpdatePayload(changedFields)

  return strapiFetchJson({
    profile,
    path: itemPath,
    method,
    token,
    body: payload,
  })
}

function buildItemPath(itemsPath, id, action) {
  const normalizedPath = stripQueryAndHash(itemsPath)
  const normalizedId = String(id || '').trim()
  if (!normalizedPath) {
    throw createHttpError(`Items path is required for online item ${action}.`, 400, { itemsPath })
  }
  if (!normalizedId) {
    throw createHttpError(`Item identifier is required for online item ${action}.`, 400, { id })
  }
  return `${normalizedPath.replace(/\/+$/, '')}/${encodeURIComponent(normalizedId)}`
}

/** Loads one item in its current server state (raw row, not normalized). */
export async function fetchCollectionItemFromStrapi({ profile, itemsPath, token = '', id, populateFields = [] }) {
  const itemPath = buildItemPath(itemsPath, id, 'fetch')
  const populateEntries = Array.from(new Set(populateFields))
    .filter(Boolean)
    .map((fieldName, index) => [`populate[${index}]`, fieldName])

  const payload = await strapiFetchJson({
    profile,
    path: buildPathWithAdditionalQueryParams(itemPath, populateEntries),
    method: 'GET',
    token,
  })

  if (!isPlainObject(payload?.data)) {
    throw createHttpError('Item response must contain an object at data.', 500, payload)
  }
  return payload.data
}

export function hasNonEmptyOnlineFieldValue(value) {
  if (value == null) return false
  if (typeof value === 'string') return value.trim().length > 0
  if (Array.isArray(value)) return value.length > 0
  if (typeof value === 'object') return Object.keys(value).length > 0
  return true
}

export function pickNonEmptyOnlineFields(fields = {}) {
  if (!isPlainObject(fields)) return {}
  const picked = {}
  Object.entries(fields).forEach(([key, value]) => {
    if (key === ONLINE_META_KEY) return
    if (!hasNonEmptyOnlineFieldValue(value)) return
    picked[key] = value
  })
  return picked
}

export async function createCollectionItemInStrapi({ profile, itemsPath, token = '', fields }) {
  const normalizedPath = stripQueryAndHash(itemsPath)
  if (!normalizedPath) {
    throw createHttpError('Items path is required for online item create.', 400, { itemsPath })
  }

  const payload = buildStrapiUpdatePayload(isPlainObject(fields) ? fields : {})

  return strapiFetchJson({
    profile,
    path: normalizedPath,
    method: 'POST',
    token,
    body: payload,
  })
}

export function resolveStableIdentifierFromRow(row) {
  return resolveStableIdentifier(row)
}
