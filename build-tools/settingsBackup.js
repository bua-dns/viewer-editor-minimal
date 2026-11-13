// Settings backup: saves every attribute of a project's Strapi `viewer-setting` single type
// (settings, wording, mappings, ...) as one file each into
// `<projectsDir>/<project>/settings-backups/<updatedAt>/`. Runs in Node only;
// the CLI is build-tools/backupSettings.js.
import fs from 'node:fs'
import path from 'node:path'

export const APP_CONFIG_FILE = path.join('public', 'app-config', 'viewer-editor-app-config.v1.json')
export const BACKUP_DIR_NAME = 'settings-backups'
export const TOKEN_ENV_KEY = 'VIEWER_SETTING_TOKEN'
export const META_FILE_KEY = '_meta'
// Fields Strapi adds to every entry; they go into _meta.json, not into a file of their own.
const STRAPI_SYSTEM_FIELDS = new Set(['id', 'documentId', 'createdAt', 'updatedAt', 'publishedAt', 'locale', 'localizations'])

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

/** Projects (sub folders of projectsDir) that have a basic config file. */
export function listBackupableProjects(projectsDir) {
  if (!fs.existsSync(projectsDir)) return []
  return fs
    .readdirSync(projectsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
    .map((entry) => entry.name)
    .filter((name) => fs.existsSync(path.join(projectsDir, name, APP_CONFIG_FILE)))
}

/** URL of the viewer-setting single type, from the project's connection profile. */
export function resolveSettingsUrl(projectDir) {
  const { baseUrl, configPath } = readConnectionProfile(projectDir)
  return `${baseUrl}${configPath.startsWith('/') ? '' : '/'}${configPath}`
}

/** `baseUrl` (without trailing slash) and `configPath` from the project's basic config file. */
export function readConnectionProfile(projectDir) {
  const fileName = path.join(projectDir, APP_CONFIG_FILE)
  if (!fs.existsSync(fileName)) throw new Error(`${fileName} not found.`)

  let appConfig
  try {
    appConfig = JSON.parse(fs.readFileSync(fileName, 'utf8'))
  } catch (error) {
    throw new Error(`${fileName}: invalid JSON (${error.message}).`)
  }

  const baseUrl = String(appConfig?.connectionProfile?.baseUrl || '').trim().replace(/\/+$/, '')
  const configPath = String(appConfig?.connectionProfile?.configPath || '').trim()
  if (!baseUrl || !configPath) {
    throw new Error(`${fileName}: connectionProfile.baseUrl and connectionProfile.configPath are required.`)
  }
  return { baseUrl, configPath }
}

// Every request of the admin CLIs gives up after this, so a hanging Strapi doesn't hang the script.
export const REQUEST_TIMEOUT_MS = 30_000

export async function fetchViewerSetting(url, { fetchImpl = fetch, token = '' } = {}) {
  const headers = { Accept: 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`

  const response = await fetchImpl(url, { headers, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) })
  if (!response.ok) throw new Error(`GET ${url} failed: HTTP ${response.status}.`)

  const body = await response.json()
  if (!isPlainObject(body?.data) || !isPlainObject(body.data.settings)) {
    throw new Error(`GET ${url}: response has no data.settings object.`)
  }
  return body
}

/**
 * Folder name stamped with the server's `updatedAt`, so an unchanged setting maps to the same
 * folder. Falls back to the fetch time when the response carries no `updatedAt`.
 */
export function backupDirName(body, now = new Date()) {
  const updatedAt = Date.parse(body?.data?.updatedAt)
  const stamp = new Date(Number.isNaN(updatedAt) ? now : updatedAt).toISOString()
  return stamp.replace(/\.\d+Z$/, 'Z').replace(/:/g, '-')
}

/**
 * Splits `data` into one entry per content attribute of the single type (settings, wording,
 * mappings, and whatever is added later) plus `_meta` for Strapi's system fields.
 */
export function splitAttributes(data, url) {
  const meta = { source: url }
  const attributes = {}
  Object.entries(data).forEach(([key, value]) => {
    if (STRAPI_SYSTEM_FIELDS.has(key)) meta[key] = value
    else attributes[key] = value
  })
  return { ...attributes, [META_FILE_KEY]: meta }
}

/** Writes `<stamp>/<attribute>.json` unless a folder for the same `updatedAt` exists. */
export function writeBackup(projectDir, body, { url = '', now = new Date() } = {}) {
  const dir = path.join(projectDir, BACKUP_DIR_NAME, backupDirName(body, now))
  if (fs.existsSync(dir)) return { dir, files: [], written: false }

  fs.mkdirSync(dir, { recursive: true })
  const files = Object.entries(splitAttributes(body.data, url)).map(([key, value]) => {
    const fileName = `${key}.json`
    fs.writeFileSync(path.join(dir, fileName), `${JSON.stringify(value, null, 2)}\n`)
    return fileName
  })
  return { dir, files, written: true }
}

export async function backupProject({ projectsDir, name, fetchImpl, token, now }) {
  const projectDir = path.join(projectsDir, name)
  const url = resolveSettingsUrl(projectDir)
  const body = await fetchViewerSetting(url, { fetchImpl, token })
  return { name, url, ...writeBackup(projectDir, body, { url, now }) }
}
