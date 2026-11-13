// Strapi side of the field config sync: reads a project's viewer-setting and content-type schema,
// runs the check, and writes the synced target collection attribute. Node only; the pure logic is
// in fieldConfigSync.js, the CLI in syncFieldConfig.js.
import fs from 'node:fs'
import path from 'node:path'
import { parseEnv } from 'node:util'
import {
  applyFieldSync,
  checkField,
  findSchemaAttributes,
  formatReport,
  listCollections,
  syncBlocker,
} from './fieldConfigSync.js'
import { backupProject, readConnectionProfile, REQUEST_TIMEOUT_MS, resolveSettingsUrl, TOKEN_ENV_KEY } from './settingsBackup.js'
import { isPlainObject } from '../src/domain/objects.js'

const CONTENT_TYPES_PATH = '/api/content-type-builder/content-types'

function readEnvFile(fileName) {
  return fs.existsSync(fileName) ? parseEnv(fs.readFileSync(fileName, 'utf8')) : {}
}

/** The Strapi token: the project's `.env.local` / `.env` first, then the tool repo's environment. */
export function resolveProjectToken(projectsDir, name, env = process.env) {
  const projectDir = path.join(projectsDir, name)
  const projectEnv = { ...readEnvFile(path.join(projectDir, '.env')), ...readEnvFile(path.join(projectDir, '.env.local')) }
  return projectEnv[TOKEN_ENV_KEY] || env[TOKEN_ENV_KEY] || ''
}

async function send(url, { fetchImpl, method, headers, body }) {
  try {
    return await fetchImpl(url, { method, headers, body, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) })
  } catch (error) {
    // A write that times out may still have reached Strapi.
    if (error?.name !== 'TimeoutError' || method === 'GET') throw error
    throw new Error(`${method} ${url} timed out; the change may have been written. Run "check" to see the current state.`)
  }
}

async function requestJson(url, { fetchImpl, token, method = 'GET', body }) {
  const headers = { Accept: 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`
  if (body) headers['Content-Type'] = 'application/json'
  const response = await send(url, { fetchImpl, method, headers, body: body ? JSON.stringify(body) : undefined })
  if (!response.ok) throw new Error(`${method} ${url} failed: HTTP ${response.status}.`)
  return response.json()
}

async function fetchSettingData(settingsUrl, options) {
  const payload = await requestJson(settingsUrl, options)
  if (!isPlainObject(payload?.data)) throw new Error(`GET ${settingsUrl}: response has no data object.`)
  return payload.data
}

// The schema is optional for reading: without it the check says so instead of failing.
async function fetchContentTypes(baseUrl, options) {
  try {
    return { contentTypes: await requestJson(`${baseUrl}${CONTENT_TYPES_PATH}`, options), schemaError: '' }
  } catch (error) {
    return { contentTypes: null, schemaError: `schema not readable (${error.message})` }
  }
}

/** Everything a check needs: the viewer-setting record and the content-type schema of the project. */
export async function loadProjectState({ projectsDir, name, token = '', fetchImpl = fetch }) {
  const projectDir = path.join(projectsDir, name)
  const { baseUrl } = readConnectionProfile(projectDir)
  const settingsUrl = resolveSettingsUrl(projectDir)
  const options = { fetchImpl, token }
  const [data, schema] = await Promise.all([fetchSettingData(settingsUrl, options), fetchContentTypes(baseUrl, options)])
  return { settingsUrl, data, collections: listCollections(data), ...schema }
}

function requireCollection(state, id, role) {
  const collection = state.data[id]
  const isListed = state.collections.some((entry) => entry.id === id)
  if (!isListed) {
    const available = state.collections.map((entry) => entry.id).join(', ') || 'none'
    throw new Error(`Unknown ${role} collection "${id}". Collections in this viewer-setting: ${available}.`)
  }
  return collection
}

/** The check report of `field` from collection `from` to `to`. */
export function checkProjectField(state, { from, to, field }) {
  if (from === to) throw new Error('Source and target must be different collections.')
  const sourceCollection = requireCollection(state, from, 'source')
  const targetCollection = requireCollection(state, to, 'target')
  const report = checkField({
    field,
    sourceCollection,
    targetCollection,
    sourceAttributes: findSchemaAttributes(state.contentTypes, sourceCollection.itemsPath) || {},
    targetAttributes: findSchemaAttributes(state.contentTypes, targetCollection.itemsPath) || {},
  })
  if (!state.contentTypes) {
    report.schema = { ok: false, problem: state.schemaError, source: 'unknown', target: 'unknown' }
  }
  return report
}

async function writeTargetAttribute({ state, options, from, to, field }) {
  // Re-read just before writing, so changes made in the meantime are kept (apart from this field).
  const fresh = await fetchSettingData(state.settingsUrl, options)
  const updated = applyFieldSync(fresh[to], field, fresh[from].fields[field])
  await requestJson(state.settingsUrl, { ...options, method: 'PUT', body: { data: { [to]: updated } } })
}

/**
 * Check, back up, confirm, write, verify. Returns `{ status, report }` with status `refused`,
 * `unchanged`, `cancelled` or `synced`. `confirm(question)` resolves to true to write.
 */
export async function syncProjectField({ projectsDir, name, token = '', fetchImpl = fetch, from, to, field, confirm, write, backup = backupProject }) {
  const options = { fetchImpl, token }
  const state = await loadProjectState({ projectsDir, name, ...options })
  const report = checkProjectField(state, { from, to, field })
  formatReport(report, { from, to }).forEach((line) => write(line))

  const blocker = syncBlocker(report)
  if (blocker) return { status: 'refused', report, message: `Sync refused: ${blocker}` }
  if (report.identical) return { status: 'unchanged', report, message: 'Nothing to sync: the configs are identical.' }

  const saved = await backup({ projectsDir, name, fetchImpl, token })
  write(`Backup: ${saved.written ? path.relative(projectsDir, saved.dir) : 'unchanged since the last backup'}`)
  if (!(await confirm(`Write "${field}" into ${to} on ${state.settingsUrl}?`))) {
    return { status: 'cancelled', report, message: 'Nothing written.' }
  }

  await writeTargetAttribute({ state, options, from, to, field })
  const verified = checkProjectField(await loadProjectState({ projectsDir, name, ...options }), { from, to, field })
  if (!verified.identical) throw new Error('Written, but the check still finds differences. Check the viewer-setting in Strapi.')
  return { status: 'synced', report: verified, message: `Synced: "${field}" in ${to} now matches ${from}.` }
}
