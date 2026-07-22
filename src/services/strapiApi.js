import { joinBaseUrlAndPath } from '../composables/connectionProfile'

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
