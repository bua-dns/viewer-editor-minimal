import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import {
  APP_CONFIG_FILE,
  BACKUP_DIR_NAME,
  backupDirName,
  backupProject,
  fetchViewerSetting,
  listBackupableProjects,
  resolveSettingsUrl,
  splitAttributes,
} from './settingsBackup.js'

let projectsDir

function writeAppConfig(name, appConfig) {
  const fileName = path.join(projectsDir, name, APP_CONFIG_FILE)
  fs.mkdirSync(path.dirname(fileName), { recursive: true })
  fs.writeFileSync(fileName, typeof appConfig === 'string' ? appConfig : JSON.stringify(appConfig))
}

const PROFILE = { connectionProfile: { baseUrl: 'https://cms.example.org/xyl/', configPath: '/api/viewer-setting' } }

function settingBody(updatedAt = '2026-11-12T12:30:07.075Z') {
  return { data: { id: 1, settings: { hierarchyFields: ['level_1', 'level_2'] }, wording: {}, updatedAt } }
}

function fakeFetch(body, status = 200) {
  const calls = []
  const impl = async (url, options) => {
    calls.push({ url, options })
    return { ok: status < 400, status, json: async () => body }
  }
  return { impl, calls }
}

beforeEach(() => {
  projectsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'settings-backup-'))
})

afterEach(() => {
  fs.rmSync(projectsDir, { recursive: true, force: true })
})

describe('listBackupableProjects', () => {
  test('lists only projects with a basic config file', () => {
    writeAppConfig('index-cards', PROFILE)
    fs.mkdirSync(path.join(projectsDir, 'misnamed-config', 'public', 'app-config'), { recursive: true })
    fs.mkdirSync(path.join(projectsDir, '.git'))
    expect(listBackupableProjects(projectsDir)).toEqual(['index-cards'])
  })

  test('returns nothing for a missing projects dir', () => {
    expect(listBackupableProjects(path.join(projectsDir, 'nope'))).toEqual([])
  })
})

describe('resolveSettingsUrl', () => {
  test('joins baseUrl and configPath without double slashes', () => {
    writeAppConfig('p', PROFILE)
    expect(resolveSettingsUrl(path.join(projectsDir, 'p'))).toBe('https://cms.example.org/xyl/api/viewer-setting')
  })

  test('fails on a missing profile, a missing file and invalid JSON', () => {
    writeAppConfig('no-profile', { connectionMode: 'online' })
    writeAppConfig('broken', '{')
    expect(() => resolveSettingsUrl(path.join(projectsDir, 'no-profile'))).toThrow(/baseUrl and connectionProfile.configPath/)
    expect(() => resolveSettingsUrl(path.join(projectsDir, 'broken'))).toThrow(/invalid JSON/)
    expect(() => resolveSettingsUrl(path.join(projectsDir, 'missing'))).toThrow(/not found/)
  })
})

describe('fetchViewerSetting', () => {
  test('sends the token as bearer header when given', async () => {
    const { impl, calls } = fakeFetch(settingBody())
    await fetchViewerSetting('https://x/api/viewer-setting', { fetchImpl: impl, token: 'secret' })
    expect(calls[0].options.headers.Authorization).toBe('Bearer secret')
  })

  test('rejects HTTP errors and responses without settings', async () => {
    await expect(fetchViewerSetting('u', { fetchImpl: fakeFetch({}, 403).impl })).rejects.toThrow(/HTTP 403/)
    await expect(fetchViewerSetting('u', { fetchImpl: fakeFetch({ data: {} }).impl })).rejects.toThrow(/no data.settings/)
  })
})

describe('backupDirName', () => {
  test('uses updatedAt, file-name safe', () => {
    expect(backupDirName(settingBody())).toBe('2026-11-12T12-30-07Z')
  })

  test('falls back to the given time without updatedAt', () => {
    expect(backupDirName({ data: {} }, new Date('2026-01-02T03:04:05Z'))).toBe('2026-01-02T03-04-05Z')
  })
})

describe('splitAttributes', () => {
  test('one entry per content attribute, system fields and source in _meta', () => {
    const data = { ...settingBody().data, documentId: 'abc', mappings: [{ target: '/api/x' }], extra: 'new' }
    const split = splitAttributes(data, 'https://x/api/viewer-setting')
    expect(Object.keys(split).sort()).toEqual(['_meta', 'extra', 'mappings', 'settings', 'wording'])
    expect(split.mappings).toEqual([{ target: '/api/x' }])
    expect(split._meta).toEqual({
      source: 'https://x/api/viewer-setting',
      id: 1,
      documentId: 'abc',
      updatedAt: '2026-11-12T12:30:07.075Z',
    })
  })
})

describe('backupProject', () => {
  const readJson = (dir, file) => JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'))

  test('writes one file per attribute into a folder per updatedAt', async () => {
    writeAppConfig('p', PROFILE)
    const run = (body) => backupProject({ projectsDir, name: 'p', fetchImpl: fakeFetch(body).impl })

    const first = await run(settingBody())
    expect(first.written).toBe(true)
    expect(first.dir).toBe(path.join(projectsDir, 'p', BACKUP_DIR_NAME, '2026-11-12T12-30-07Z'))
    expect(fs.readdirSync(first.dir).sort()).toEqual(['_meta.json', 'settings.json', 'wording.json'])
    expect(readJson(first.dir, 'settings.json')).toEqual(settingBody().data.settings)
    expect(readJson(first.dir, '_meta.json').source).toBe('https://cms.example.org/xyl/api/viewer-setting')

    expect((await run(settingBody())).written).toBe(false)
    expect((await run(settingBody('2026-11-13T08:00:00.000Z'))).written).toBe(true)
    expect(fs.readdirSync(path.join(projectsDir, 'p', BACKUP_DIR_NAME))).toHaveLength(2)
  })
})
