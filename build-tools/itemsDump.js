// Items dump: saves every item of a project's Strapi collection, page by page, as raw rows into
// `<projectsDir>/<project>/item-dumps/<collection>/<fetch time>/items.json` (+ `_meta.json`).
// Runs in Node only; the CLI is build-tools/dumpItems.js.
import fs from 'node:fs'
import path from 'node:path'
import { fetchViewerSetting, readConnectionProfile, REQUEST_TIMEOUT_MS, resolveSettingsUrl } from './settingsBackup.js'

export const DUMP_DIR_NAME = 'item-dumps'
export const ITEMS_FILE = 'items.json'
export const META_FILE = '_meta.json'
export const DEFAULT_PAGE_SIZE = 100

/** The collection path the viewer-setting points to (`itemsPath`, legacy `item_path`), or ''. */
export function resolveItemsPath(settings) {
  return String(settings?.itemsPath || settings?.item_path || '').trim()
}

/**
 * URL of one page. Keeps a query already in `itemsPath`; adds `populate=*` (first-level relations
 * and components) and a stable `sort=id:asc` only when the path sets neither.
 */
export function buildPageUrl(baseUrl, itemsPath, { page, pageSize }) {
  const url = new URL(`${baseUrl}${itemsPath.startsWith('/') ? '' : '/'}${itemsPath}`)
  const keys = [...url.searchParams.keys()]
  if (!keys.some((key) => key.startsWith('populate'))) url.searchParams.set('populate', '*')
  if (!keys.some((key) => key.startsWith('sort'))) url.searchParams.set('sort', 'id:asc')
  url.searchParams.set('pagination[page]', String(page))
  url.searchParams.set('pagination[pageSize]', String(pageSize))
  return url.toString()
}

async function getJson(url, { fetchImpl, token }) {
  const headers = { Accept: 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`
  const response = await fetchImpl(url, { headers, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) })
  if (!response.ok) throw new Error(`GET ${url} failed: HTTP ${response.status}.`)
  return response.json()
}

/** All rows of the collection, unchanged, in server order. `onPage(page, pageCount)` reports progress. */
export async function fetchAllItems(baseUrl, itemsPath, options = {}) {
  const { fetchImpl = fetch, token = '', pageSize = DEFAULT_PAGE_SIZE, onPage = () => {} } = options
  const items = []
  let pageCount = 1
  for (let page = 1; page <= pageCount; page += 1) {
    const url = buildPageUrl(baseUrl, itemsPath, { page, pageSize })
    const body = await getJson(url, { fetchImpl, token })
    if (!Array.isArray(body?.data)) throw new Error(`GET ${url}: response has no data array.`)
    items.push(...body.data)
    pageCount = Number(body.meta?.pagination?.pageCount) || 1
    onPage(page, pageCount)
  }
  return items
}

/** Folder-safe name of the collection: the last path segment, e.g. `/api/index-cards` → `index-cards`. */
export function collectionDirName(itemsPath) {
  const segment = itemsPath.split(/[?#]/)[0].split('/').filter(Boolean).pop() || 'items'
  return segment.replace(/[^a-z0-9_-]/gi, '_')
}

export function dumpDirName(now = new Date()) {
  return now.toISOString().replace(/\.\d+Z$/, 'Z').replace(/:/g, '-')
}

export function writeDump(projectDir, { itemsPath, source, items, now = new Date() }) {
  const dir = path.join(projectDir, DUMP_DIR_NAME, collectionDirName(itemsPath), dumpDirName(now))
  fs.mkdirSync(dir, { recursive: true })
  const meta = { source, itemsPath, count: items.length, fetchedAt: now.toISOString() }
  fs.writeFileSync(path.join(dir, ITEMS_FILE), `${JSON.stringify(items, null, 2)}\n`)
  fs.writeFileSync(path.join(dir, META_FILE), `${JSON.stringify(meta, null, 2)}\n`)
  return dir
}

/** `collection` overrides the viewer-setting's `itemsPath`; without it the setting is fetched. */
async function resolveCollection(projectDir, { collection, fetchImpl, token }) {
  if (collection) return collection
  const settingsUrl = resolveSettingsUrl(projectDir)
  const body = await fetchViewerSetting(settingsUrl, { fetchImpl, token })
  const itemsPath = resolveItemsPath(body.data.settings)
  if (!itemsPath) throw new Error(`${settingsUrl}: settings have no itemsPath; pass --collection.`)
  return itemsPath
}

export async function dumpProject({ projectsDir, name, collection = '', fetchImpl = fetch, token = '', pageSize, onPage, now }) {
  const projectDir = path.join(projectsDir, name)
  const { baseUrl } = readConnectionProfile(projectDir)
  const itemsPath = await resolveCollection(projectDir, { collection, fetchImpl, token })
  const items = await fetchAllItems(baseUrl, itemsPath, { fetchImpl, token, pageSize, onPage })
  const source = `${baseUrl}${itemsPath.startsWith('/') ? '' : '/'}${itemsPath}`
  const dir = writeDump(projectDir, { itemsPath, source, items, now })
  return { name, itemsPath, source, count: items.length, dir }
}
