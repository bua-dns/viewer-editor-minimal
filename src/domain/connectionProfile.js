const CONNECTION_PROFILE_VERSION = 1

function isHttpProtocol(protocol) {
  return protocol === 'http:' || protocol === 'https:'
}

export function normalizeBaseUrl(value) {
  const trimmed = String(value || '').trim()
  if (!trimmed) return ''

  try {
    const parsed = new URL(trimmed)
    if (!isHttpProtocol(parsed.protocol)) return trimmed
    if (parsed.search || parsed.hash) return trimmed

    const normalizedPath = parsed.pathname.replace(/\/+$/g, '')
    if (!normalizedPath || normalizedPath === '/') {
      return parsed.origin
    }

    return `${parsed.origin}${normalizedPath}`
  } catch {
    return trimmed
  }
}

export function normalizeConfigPath(value) {
  const trimmed = String(value || '').trim()
  if (!trimmed) return ''
  if (/^https?:\/\//i.test(trimmed)) return trimmed

  const withoutLeadingSlash = trimmed.replace(/^\/+/, '')
  return withoutLeadingSlash ? `/${withoutLeadingSlash}` : '/'
}

export function normalizeConnectionProfile(input = {}) {
  return {
    version: CONNECTION_PROFILE_VERSION,
    label: String(input.label || '').trim(),
    baseUrl: normalizeBaseUrl(input.baseUrl),
    configPath: normalizeConfigPath(input.configPath),
    updatedAt: String(input.updatedAt || '').trim(),
  }
}

export function validateConnectionProfile(input = {}) {
  const profile = normalizeConnectionProfile(input)
  const errors = {}

  if (profile.version !== CONNECTION_PROFILE_VERSION) {
    errors.version = 'Version must be 1.'
  }

  if (profile.label && profile.label.length > 120) {
    errors.label = 'Label must be 120 characters or fewer.'
  }

  if (!profile.baseUrl) {
    errors.baseUrl = 'Base URL is required.'
  } else {
    try {
      const parsedBase = new URL(profile.baseUrl)
      if (!isHttpProtocol(parsedBase.protocol)) {
        errors.baseUrl = 'Base URL must use http or https.'
      } else if (parsedBase.search || parsedBase.hash) {
        errors.baseUrl = 'Base URL must not include query or hash.'
      }
    } catch {
      errors.baseUrl = 'Base URL must be an absolute http(s) URL.'
    }
  }

  if (!profile.configPath) {
    errors.configPath = 'Config path is required.'
  } else if (/^https?:\/\//i.test(profile.configPath)) {
    errors.configPath = 'Config path must be a relative path that starts with "/".'
  } else if (!profile.configPath.startsWith('/')) {
    errors.configPath = 'Config path must start with "/".'
  }

  if (profile.updatedAt) {
    const timestamp = Date.parse(profile.updatedAt)
    if (Number.isNaN(timestamp)) {
      errors.updatedAt = 'updatedAt must be an ISO datetime string.'
    }
  }

  return {
    ok: Object.keys(errors).length === 0,
    errors,
    profile,
  }
}

export function createSavedConnectionProfile(input = {}) {
  const normalized = normalizeConnectionProfile(input)
  const profile = {
    version: CONNECTION_PROFILE_VERSION,
    baseUrl: normalized.baseUrl,
    configPath: normalized.configPath,
    updatedAt: new Date().toISOString(),
  }

  if (normalized.label) {
    profile.label = normalized.label
  }

  return profile
}

export function parseConnectionProfileJsonText(text) {
  try {
    const parsed = JSON.parse(String(text || ''))
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { ok: false, error: 'Connection profile JSON must be an object.' }
    }
    return { ok: true, value: parsed }
  } catch {
    return { ok: false, error: 'Invalid JSON file.' }
  }
}

export function joinBaseUrlAndPath(baseUrl, path) {
  const normalizedBase = String(baseUrl || '').replace(/\/+$/g, '')
  const normalizedPath = String(path || '').startsWith('/') ? String(path || '') : `/${String(path || '')}`
  return `${normalizedBase}${normalizedPath}`
}
