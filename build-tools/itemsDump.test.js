import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { APP_CONFIG_FILE } from './settingsBackup.js'
import {
  buildPageUrl,
  collectionDirName,
  DUMP_DIR_NAME,
  dumpProject,
  fetchAllItems,
  ITEMS_FILE,
  META_FILE,
  resolveItemsPath,
} from './itemsDump.js'

const BASE = 'https://cms.example.org/xyl'
const PROFILE = { connectionProfile: { baseUrl: `${BASE}/`, configPath: '/api/viewer-setting' } }
const NOW = new Date('2026-11-12T15:00:00.123Z')

let projectsDir

beforeEach(() => {
  projectsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'items-dump-'))
  const fileName = path.join(projectsDir, 'p', APP_CONFIG_FILE)
  fs.mkdirSync(path.dirname(fileName), { recursive: true })
  fs.writeFileSync(fileName, JSON.stringify(PROFILE))
})

afterEach(() => {
  fs.rmSync(projectsDir, { recursive: true, force: true })
})

// Serves the viewer-setting and a collection of `total` rows, paginated like Strapi.
function fakeStrapi({ total = 5, settings = { itemsPath: '/api/index-cards' }, failPage = 0 } = {}) {
  const calls = []
  const impl = async (url, options) => {
    calls.push({ url, options })
    const parsed = new URL(url)
    if (parsed.pathname.endsWith('/viewer-setting')) {
      return { ok: true, status: 200, json: async () => ({ data: { settings } }) }
    }
    const page = Number(parsed.searchParams.get('pagination[page]'))
    const pageSize = Number(parsed.searchParams.get('pagination[pageSize]'))
    if (page === failPage) return { ok: false, status: 403, json: async () => ({}) }
    const start = (page - 1) * pageSize
    const data = Array.from({ length: Math.max(0, Math.min(pageSize, total - start)) }, (_, i) => ({ id: start + i + 1 }))
    const pagination = { page, pageSize, pageCount: Math.ceil(total / pageSize), total }
    return { ok: true, status: 200, json: async () => ({ data, meta: { pagination } }) }
  }
  return { impl, calls }
}

describe('resolveItemsPath', () => {
  test('reads itemsPath, falls back to legacy item_path, else empty', () => {
    expect(resolveItemsPath({ itemsPath: ' /api/a ' })).toBe('/api/a')
    expect(resolveItemsPath({ item_path: '/api/b' })).toBe('/api/b')
    expect(resolveItemsPath({})).toBe('')
    expect(resolveItemsPath(null)).toBe('')
  })
})

describe('buildPageUrl', () => {
  test('adds populate, sort and pagination', () => {
    const url = new URL(buildPageUrl(BASE, '/api/cards', { page: 2, pageSize: 50 }))
    expect(url.pathname).toBe('/xyl/api/cards')
    expect(url.searchParams.get('populate')).toBe('*')
    expect(url.searchParams.get('sort')).toBe('id:asc')
    expect(url.searchParams.get('pagination[page]')).toBe('2')
    expect(url.searchParams.get('pagination[pageSize]')).toBe('50')
  })

  test('keeps populate and sort already in the path', () => {
    const url = new URL(buildPageUrl(BASE, '/api/cards?populate[0]=scan&sort=label', { page: 1, pageSize: 10 }))
    expect(url.searchParams.get('populate')).toBeNull()
    expect(url.searchParams.get('populate[0]')).toBe('scan')
    expect(url.searchParams.getAll('sort')).toEqual(['label'])
  })
})

describe('fetchAllItems', () => {
  test('collects every page in order and sends the token', async () => {
    const { impl, calls } = fakeStrapi({ total: 5 })
    const items = await fetchAllItems(BASE, '/api/cards', { fetchImpl: impl, token: 't', pageSize: 2 })
    expect(items.map((item) => item.id)).toEqual([1, 2, 3, 4, 5])
    expect(calls).toHaveLength(3)
    expect(calls[0].options.headers.Authorization).toBe('Bearer t')
  })

  test('fails on an HTTP error instead of returning a partial list', async () => {
    const { impl } = fakeStrapi({ total: 5, failPage: 2 })
    await expect(fetchAllItems(BASE, '/api/cards', { fetchImpl: impl, pageSize: 2 })).rejects.toThrow(/HTTP 403/)
  })
})

describe('collectionDirName', () => {
  test('uses the last path segment', () => {
    expect(collectionDirName('/api/index-cards?populate=*')).toBe('index-cards')
    expect(collectionDirName('/')).toBe('items')
  })
})

describe('dumpProject', () => {
  test('dumps the viewer-setting collection into item-dumps/<collection>/<time>/', async () => {
    const { impl } = fakeStrapi({ total: 3 })
    const result = await dumpProject({ projectsDir, name: 'p', fetchImpl: impl, now: NOW })

    const expectedDir = path.join(projectsDir, 'p', DUMP_DIR_NAME, 'index-cards', '2026-11-12T15-00-00Z')
    expect(result.dir).toBe(expectedDir)
    expect(result.count).toBe(3)
    expect(JSON.parse(fs.readFileSync(path.join(expectedDir, ITEMS_FILE), 'utf8'))).toHaveLength(3)
    expect(JSON.parse(fs.readFileSync(path.join(expectedDir, META_FILE), 'utf8'))).toEqual({
      source: `${BASE}/api/index-cards`,
      itemsPath: '/api/index-cards',
      count: 3,
      fetchedAt: NOW.toISOString(),
    })
  })

  test('--collection skips the viewer-setting', async () => {
    const { impl, calls } = fakeStrapi({ total: 1 })
    const result = await dumpProject({ projectsDir, name: 'p', collection: '/api/collection-items', fetchImpl: impl, now: NOW })
    expect(result.itemsPath).toBe('/api/collection-items')
    expect(calls.some((call) => call.url.includes('viewer-setting'))).toBe(false)
  })

  test('fails when the setting names no collection', async () => {
    const { impl } = fakeStrapi({ settings: { fields: {} } })
    await expect(dumpProject({ projectsDir, name: 'p', fetchImpl: impl })).rejects.toThrow(/--collection/)
  })
})
