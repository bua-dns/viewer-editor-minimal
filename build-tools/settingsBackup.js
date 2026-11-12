// Settings backup: saves the current Strapi `viewer-setting` response (settings, wording,
// mappings) of a project into `<projectsDir>/<project>/settings-backups/`. Runs in Node only;
// the CLI is build-tools/backupSettings.js.
import fs from 'node:fs'
import path from 'node:path'

export const APP_CONFIG_FILE = path.join('public', 'app-config', 'viewer-editor-app-config.v1.json')
export const BACKUP_DIR_NAME = 'settings-backups'
export const TOKEN_ENV_KEY = 'VIEWER_SETTING_TOKEN'

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
  return `${baseUrl}${configPath.startsWith('/') ? '' : '/'}${configPath}`
}

export async function fetchViewerSetting(url, { fetchImpl = fetch, token = '' } = {}) {
  const headers = { Accept: 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`

  const response = await fetchImpl(url, { headers })
  if (!response.ok) throw new Error(`GET ${url} failed: HTTP ${response.status}.`)

  const body = await response.json()
  if (!isPlainObject(body?.data) || !isPlainObject(body.data.settings)) {
    throw new Error(`GET ${url}: response has no data.settings object.`)
  }
  return body
}

/**
 * File name stamped with the server's `updatedAt`, so an unchanged setting maps to the same
 * file. Falls back to the fetch time when the response carries no `updatedAt`.
 */
export function backupFileName(body, now = new Date()) {
  const updatedAt = Date.parse(body?.data?.updatedAt)
  const stamp = new Date(Number.isNaN(updatedAt) ? now : updatedAt).toISOString()
  return `viewer-setting-${stamp.replace(/\.\d+Z$/, 'Z').replace(/:/g, '-')}.json`
}

/** Writes the backup unless a file for the same `updatedAt` exists. */
export function writeBackup(projectDir, body, now = new Date()) {
  const backupDir = path.join(projectDir, BACKUP_DIR_NAME)
  const fileName = path.join(backupDir, backupFileName(body, now))
  if (fs.existsSync(fileName)) return { fileName, written: false }

  fs.mkdirSync(backupDir, { recursive: true })
  fs.writeFileSync(fileName, `${JSON.stringify(body, null, 2)}\n`)
  return { fileName, written: true }
}

export async function backupProject({ projectsDir, name, fetchImpl, token, now }) {
  const projectDir = path.join(projectsDir, name)
  const url = resolveSettingsUrl(projectDir)
  const body = await fetchViewerSetting(url, { fetchImpl, token })
  return { name, url, ...writeBackup(projectDir, body, now) }
}
