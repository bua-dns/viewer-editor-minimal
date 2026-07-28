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

export async function strapiFetchJson({ profile, path, method = 'GET', token = '', body = undefined }) {
  const requestUrl = joinBaseUrlAndPath(profile.baseUrl, path)
  const headers = {
    Accept: 'application/json',
  }

  if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  const response = await fetch(requestUrl, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  })

  const payload = await parseJsonResponseSafe(response)

  if (!response.ok) {
    const backendMessage = payload?.error?.message || payload?.message
    const message = backendMessage || `Request failed with HTTP ${response.status}.`
    throw createHttpError(message, response.status, payload)
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

  return {
    payload,
    settings,
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

  return {
    payload,
    settings: updatedSettings,
  }
}

export function resolveItemsPathFromSettings(settings = {}) {
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) return ''

  const itemsPath = String(settings.itemsPath || '').trim()
  if (itemsPath) return itemsPath

  const legacyItemsPath = String(settings.item_path || '').trim()
  if (legacyItemsPath) return legacyItemsPath

  return ''
}

export async function fetchAllCollectionItemsFromStrapi({ profile, itemsPath, token = '', pageSize = 100 }) {
  const collected = []
  let page = 1
  let pageCount = 1

  while (page <= pageCount) {
    const separator = itemsPath.includes('?') ? '&' : '?'
    const pagedPath = `${itemsPath}${separator}pagination[page]=${page}&pagination[pageSize]=${pageSize}`

    const payload = await strapiFetchJson({
      profile,
      path: pagedPath,
      method: 'GET',
      token,
    })

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

export function normalizeStrapiItem(row, settingsFieldKeys = [], itemsPath = '') {
  const source = isPlainObject(row) ? row : {}
  const attributes = isPlainObject(source.attributes) ? source.attributes : null
  const valueSource = attributes || source

  const stableIdentifier = resolveStableIdentifier(source) || resolveStableIdentifier(valueSource)
  if (!stableIdentifier) {
    throw createHttpError('Online item is missing a stable identifier (documentId or id).', 500, row)
  }

  const nextItem = {}

  settingsFieldKeys.forEach((fieldKey) => {
    if (Object.prototype.hasOwnProperty.call(valueSource, fieldKey)) {
      nextItem[fieldKey] = valueSource[fieldKey]
    }
  })

  if (Object.prototype.hasOwnProperty.call(valueSource, 'scan')) {
    nextItem.scan = valueSource.scan
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
  const normalizedPath = stripQueryAndHash(itemsPath)
  const normalizedId = String(id || '').trim()
  if (!normalizedPath) {
    throw createHttpError('Items path is required for online item update.', 400, { itemsPath })
  }
  if (!normalizedId) {
    throw createHttpError('Item identifier is required for online item update.', 400, { id })
  }

  const payload = buildStrapiUpdatePayload(changedFields)
  const itemPath = `${normalizedPath.replace(/\/+$/, '')}/${encodeURIComponent(normalizedId)}`

  return strapiFetchJson({
    profile,
    path: itemPath,
    method,
    token,
    body: payload,
  })
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
