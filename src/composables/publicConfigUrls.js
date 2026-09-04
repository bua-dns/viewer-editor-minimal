// Auflösung der Kandidaten-URLs für Konfigurationsdateien, die neben dem Build in
// `public/` liegen (Verbindungsprofil, App-Config). Die App wird unter wechselnden
// Basispfaden ausgeliefert (`base` in `vite.config.js`, Unterverzeichnisse beim
// Hosting), deshalb wird nicht eine URL geraten, sondern eine Kandidatenliste vom
// spezifischsten zum allgemeinsten Präfix erzeugt und der Reihe nach probiert.

function uniqueNonEmpty(values) {
  return Array.from(new Set(values.filter(Boolean)))
}

function normalizePathPrefix(value) {
  const normalized = String(value || '').trim()
  if (!normalized) return '/'

  const withLeadingSlash = normalized.startsWith('/') ? normalized : `/${normalized}`
  return withLeadingSlash.endsWith('/') ? withLeadingSlash : `${withLeadingSlash}/`
}

function collectLocationPathPrefixes() {
  const pathname = String(globalThis?.location?.pathname || '').trim()
  if (!pathname) return []

  const sanitizedPathname = pathname.split('?')[0].split('#')[0]
  const segments = sanitizedPathname.split('/').filter(Boolean)
  const pointsToDirectory = sanitizedPathname.endsWith('/')
  const directorySegments = pointsToDirectory ? segments : segments.slice(0, -1)

  const prefixes = []
  for (let index = directorySegments.length; index >= 0; index -= 1) {
    const partialSegments = directorySegments.slice(0, index)
    const prefix = partialSegments.length ? `/${partialSegments.join('/')}/` : '/'
    prefixes.push(prefix)
  }

  return uniqueNonEmpty(prefixes)
}

export function resolveRuntimePathPrefixes() {
  const rawBasePath = String(import.meta?.env?.BASE_URL || '/').trim()
  const basePath = normalizePathPrefix(rawBasePath)
  const locationPrefixes = collectLocationPathPrefixes()
  return uniqueNonEmpty([...locationPrefixes, basePath, '/'])
}

// `folder` ist das Unterverzeichnis in `public/`, in dem ein blosser Dateiname
// gesucht wird. Enthaelt `value` selbst einen Pfad, gilt dieser unveraendert.
export function resolvePublicConfigUrls(value, folder = '') {
  const normalized = String(value || '').trim()
  if (!normalized) return []

  if (/^https?:\/\//i.test(normalized)) return [normalized]

  const prefixes = resolveRuntimePathPrefixes()
  const cleanedPath = normalized.replace(/^\/+/, '')

  if (normalized.startsWith('/') || normalized.includes('/')) {
    return uniqueNonEmpty(prefixes.map((prefix) => `${prefix}${cleanedPath}`))
  }

  const normalizedFolder = String(folder || '').replace(/^\/+|\/+$/g, '')
  const direct = prefixes.map((prefix) => `${prefix}${cleanedPath}`)
  if (!normalizedFolder) return uniqueNonEmpty(direct)

  const withFolder = prefixes.map((prefix) => `${prefix}${normalizedFolder}/${cleanedPath}`)
  return uniqueNonEmpty([...withFolder, ...direct])
}

// Probiert die Kandidaten-URLs der Reihe nach und liefert den Rohtext der ersten
// erfolgreichen Antwort.
export async function fetchFirstAvailableConfigText(urls) {
  if (typeof globalThis.fetch !== 'function') {
    return { ok: false, reason: 'fetch-unavailable', error: 'Fetch API is not available in this environment.' }
  }

  let lastError = null
  for (const candidateUrl of urls) {
    try {
      const response = await fetch(candidateUrl, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
      })
      if (!response.ok) {
        lastError = `Could not load config file (HTTP ${response.status}).`
        continue
      }
      return { ok: true, text: await response.text(), url: candidateUrl }
    } catch {
      lastError = 'Could not load config file.'
    }
  }

  return { ok: false, reason: 'fetch-failed', error: lastError || 'Could not load config file.' }
}
