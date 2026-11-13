import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { checkProjectField, loadProjectState, resolveProjectToken, syncProjectField } from './fieldSyncStrapi.js'
import { APP_CONFIG_FILE } from './settingsBackup.js'

let projectsDir

const reference = { type: 'component', component: 'metadata-forms.wikidata-reference', repeatable: true }
const contentTypes = {
  data: [
    { schema: { pluralName: 'index-cards', attributes: { collectors: reference } } },
    { schema: { pluralName: 'collection-items', attributes: { collectors: reference } } },
  ],
}

function settingData() {
  return {
    id: 1,
    settings: { itemsPath: '/api/index-cards', fields: {} },
    index_cards: { itemsPath: '/api/index-cards', fields: { collectors: { type: 'wikidata-autosuggest', order: 9, autosuggest: { limit: 50, minChars: 3 } } } },
    collection_items: { itemsPath: '/api/collection-items', fields: { collectors: { type: 'wikidata-autosuggest', order: 6, autosuggest: { limit: 50 } } } },
  }
}

// A fake Strapi: GET viewer-setting / content-types, PUT merges the sent attributes into the record.
function fakeStrapi({ schemaStatus = 200 } = {}) {
  const record = settingData()
  const calls = []
  const impl = async (url, options = {}) => {
    calls.push({ url, method: options.method || 'GET', headers: options.headers, body: options.body, signal: options.signal })
    if (url.endsWith('/content-types')) return { ok: schemaStatus < 400, status: schemaStatus, json: async () => contentTypes }
    if (options.method === 'PUT') Object.assign(record, JSON.parse(options.body).data)
    return { ok: true, status: 200, json: async () => ({ data: structuredClone(record) }) }
  }
  return { impl, calls, record }
}

function writeProject(name, { envLocal } = {}) {
  const fileName = path.join(projectsDir, name, APP_CONFIG_FILE)
  fs.mkdirSync(path.dirname(fileName), { recursive: true })
  fs.writeFileSync(fileName, JSON.stringify({ connectionProfile: { baseUrl: 'https://cms.example.org/xyl', configPath: '/api/viewer-setting' } }))
  if (envLocal) fs.writeFileSync(path.join(projectsDir, name, '.env.local'), envLocal)
}

const args = { from: 'index_cards', to: 'collection_items', field: 'collectors' }

beforeEach(() => {
  projectsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'field-sync-'))
  writeProject('xyl')
})

afterEach(() => {
  fs.rmSync(projectsDir, { recursive: true, force: true })
})

function syncOptions(strapi, overrides = {}) {
  return {
    projectsDir,
    name: 'xyl',
    token: 't',
    fetchImpl: strapi.impl,
    ...args,
    write: vi.fn(),
    confirm: vi.fn(async () => true),
    backup: vi.fn(async () => ({ written: true, dir: path.join(projectsDir, 'xyl', 'settings-backups', 'stamp') })),
    ...overrides,
  }
}

describe('resolveProjectToken', () => {
  test("takes the project's .env.local first, then the environment", () => {
    writeProject('with-token', { envLocal: 'VIEWER_SETTING_TOKEN=project-token\n' })
    expect(resolveProjectToken(projectsDir, 'with-token', { VIEWER_SETTING_TOKEN: 'repo-token' })).toBe('project-token')
    expect(resolveProjectToken(projectsDir, 'xyl', { VIEWER_SETTING_TOKEN: 'repo-token' })).toBe('repo-token')
    expect(resolveProjectToken(projectsDir, 'xyl', {})).toBe('')
  })
})

describe('check', () => {
  test('loads the record and the schema with the token and reports the differences', async () => {
    const strapi = fakeStrapi()
    const state = await loadProjectState({ projectsDir, name: 'xyl', token: 't', fetchImpl: strapi.impl })
    expect(state.collections.map((entry) => entry.id)).toEqual(['index_cards', 'collection_items'])
    expect(strapi.calls.every((call) => call.headers.Authorization === 'Bearer t')).toBe(true)

    const report = checkProjectField(state, args)
    expect(report.schema.ok).toBe(true)
    expect(report.differences.map((entry) => entry.path)).toEqual(['autosuggest.minChars'])
  })

  test('says that the schema is not readable instead of failing', async () => {
    const state = await loadProjectState({ projectsDir, name: 'xyl', fetchImpl: fakeStrapi({ schemaStatus: 403 }).impl })
    const report = checkProjectField(state, args)
    expect(report.schema).toMatchObject({ ok: false, source: 'unknown' })
    expect(report.schema.problem).toMatch(/schema not readable .*HTTP 403/)
  })

  test('rejects unknown collections and source = target', async () => {
    const state = await loadProjectState({ projectsDir, name: 'xyl', fetchImpl: fakeStrapi().impl })
    expect(() => checkProjectField(state, { ...args, to: 'settings' })).toThrow(/Unknown target collection "settings"/)
    expect(() => checkProjectField(state, { ...args, to: 'index_cards' })).toThrow(/must be different/)
  })
})

describe('sync', () => {
  test('backs up, asks, writes only the target attribute and verifies', async () => {
    const strapi = fakeStrapi()
    const options = syncOptions(strapi)
    const result = await syncProjectField(options)

    expect(result.status).toBe('synced')
    expect(options.backup).toHaveBeenCalledTimes(1)
    expect(options.confirm).toHaveBeenCalledWith('Write "collectors" into collection_items on https://cms.example.org/xyl/api/viewer-setting?')
    const put = strapi.calls.find((call) => call.method === 'PUT')
    expect(Object.keys(JSON.parse(put.body).data)).toEqual(['collection_items'])
    expect(strapi.record.collection_items.fields.collectors).toEqual({
      type: 'wikidata-autosuggest',
      order: 6,
      autosuggest: { limit: 50, minChars: 3 },
    })
  })

  test('every request has a timeout; a timed-out write says it may have happened', async () => {
    const strapi = fakeStrapi()
    const impl = async (url, options = {}) => {
      if (options.method === 'PUT') throw new DOMException('The operation was aborted due to timeout', 'TimeoutError')
      return strapi.impl(url, options)
    }
    await expect(syncProjectField(syncOptions(strapi, { fetchImpl: impl }))).rejects.toThrow(
      /PUT .* timed out; the change may have been written\. Run "check"/,
    )
    expect(strapi.calls.length).toBeGreaterThan(0)
    expect(strapi.calls.every((call) => call.signal instanceof AbortSignal)).toBe(true)
  })

  test('writes nothing when the user says no', async () => {
    const strapi = fakeStrapi()
    const result = await syncProjectField(syncOptions(strapi, { confirm: async () => false }))
    expect(result.status).toBe('cancelled')
    expect(strapi.calls.some((call) => call.method === 'PUT')).toBe(false)
  })

  test('refuses without backup or question when the Strapi check fails', async () => {
    const strapi = fakeStrapi({ schemaStatus: 403 })
    const options = syncOptions(strapi)
    const result = await syncProjectField(options)
    expect(result).toMatchObject({ status: 'refused' })
    expect(result.message).toMatch(/Sync refused: Strapi check failed: schema not readable/)
    expect(options.backup).not.toHaveBeenCalled()
    expect(options.confirm).not.toHaveBeenCalled()
  })

  test('does nothing when the configs are already identical', async () => {
    const strapi = fakeStrapi()
    strapi.record.collection_items.fields.collectors.autosuggest.minChars = 3
    const options = syncOptions(strapi)
    expect((await syncProjectField(options)).status).toBe('unchanged')
    expect(options.backup).not.toHaveBeenCalled()
  })
})
