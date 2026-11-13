// @vitest-environment jsdom
//
// Characterization test of App.vue (plan-composition-root phase 1.2): mounts the whole app and pins
// the top-level flows that live in the composition root. Assertions check requests, rendered text
// and form state, never class-based layout, so the extraction phases can move code without
// touching this file. Covered so far: the offline scenarios; the online ones need a Strapi stub.
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { chooseFile, installDomStubs } from '../test/helpers/domStubs'

const hierarchyFile = {
  data: [
    { title: 'Eiche', region: 'Brandenburg', site: 'Lebus', scan: '' },
    { title: 'Kiefer', region: 'Brandenburg', site: 'Lebus', scan: '' },
    { title: 'Linde', region: 'Brandenburg', site: 'Oderberg', scan: '' },
    { title: 'Buche', region: 'Sachsen', site: 'Dresden', scan: '' },
  ],
  config: {
    fields: {
      title: { type: 'normal' },
      region: { type: 'normal' },
      site: { type: 'normal' },
    },
    itemLabelField: 'title',
    hierarchyFields: ['region', 'site'],
  },
}

const flatFile = {
  data: [
    { title: 'Eiche', scan: '' },
    { title: 'Kiefer', scan: '' },
    { title: 'Linde', scan: '' },
  ],
  config: { fields: { title: { type: 'normal' } }, itemLabelField: 'title' },
}

let restoreDom
let fetchMock
let wrapper

async function mountApp() {
  // Stores keep module-level state: every test starts from a fresh module graph.
  vi.resetModules()
  const { default: App } = await import('./App.vue')
  wrapper = mount(App, {
    attachTo: document.body,
    global: { stubs: { WikidataAutosuggestInput: true } },
  })
  await flushPromises()
  return wrapper
}

function jsonFile(payload, name) {
  return new File([JSON.stringify(payload)], name, { type: 'application/json' })
}

async function importFile(payload, name) {
  chooseFile(wrapper.find('input[type="file"]').element, jsonFile(payload, name))
  await vi.waitFor(async () => {
    await flushPromises()
    if (!wrapper.text().includes(name) && !wrapper.find('[role="alert"]').exists()) {
      throw new Error('import not finished')
    }
  })
}

function cards() {
  return wrapper.findAll('.item-card')
}

function cardCaptions() {
  return cards().map((card) => card.find('.card-caption span').text())
}

function cardByCaption(caption) {
  return cards().find((card) => card.find('.card-caption span').text() === caption)
}

function alerts() {
  return wrapper.findAll('[role="alert"]').map((node) => node.text())
}

beforeEach(() => {
  restoreDom = installDomStubs()
  fetchMock = vi.fn(async () => {
    throw new Error('unexpected request')
  })
  globalThis.fetch = fetchMock
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  restoreDom()
  document.body.innerHTML = ''
})

describe('App.vue offline', () => {
  test('mounting sends no request and starts without data', async () => {
    await mountApp()
    expect(fetchMock).not.toHaveBeenCalled()
    expect(cards()).toHaveLength(0)
  })

  test('a JSON file with two hierarchy fields opens in the hierarchy view', async () => {
    await mountApp()
    await importFile(hierarchyFile, 'woods.json')

    const boxes = wrapper.findAll('.hierarchy-level1-box')
    expect(boxes.map((box) => box.text())).toEqual(['Brandenburg3', 'Sachsen1'])

    await boxes[0].trigger('click')
    await flushPromises()
    // The first level-2 group (Lebus) opens by itself.
    expect(cardCaptions()).toEqual(['Eiche', 'Kiefer'])
  })

  test('an import with an invalid config shows the error and keeps the loaded data (plan 0.1)', async () => {
    await mountApp()
    await importFile(flatFile, 'woods.json')
    expect(cardCaptions()).toEqual(['Eiche', 'Kiefer', 'Linde'])

    await importFile({ data: [{ title: 'X' }], config: { fields: 'broken' } }, 'broken.json')

    expect(alerts().join(' ')).toContain('config.fields')
    expect(cardCaptions()).toEqual(['Eiche', 'Kiefer', 'Linde'])
  })

  test('suspending the last item keeps it suspended (plan 0.4)', async () => {
    await mountApp()
    await importFile(flatFile, 'woods.json')

    await cards()[2].trigger('click')
    await flushPromises()
    const sidebarToggle = wrapper.find('#sidebar-suspend-editing')
    sidebarToggle.element.checked = true
    await sidebarToggle.trigger('change')
    await flushPromises()

    expect(wrapper.find('#sidebar-suspend-editing').element.checked).toBe(true)
    expect(cards()[2].find('input[type="checkbox"]').element.checked).toBe(true)
  })

  test('selecting a suspended item resumes it', async () => {
    await mountApp()
    await importFile({ ...flatFile, suspendedItems: [1] }, 'woods.json')
    // Suspended items are sorted to the end of the list.
    expect(cardCaptions()).toEqual(['Eiche', 'Linde', 'Kiefer'])
    expect(cardByCaption('Kiefer').find('input[type="checkbox"]').element.checked).toBe(true)

    await cardByCaption('Kiefer').trigger('click')
    await flushPromises()

    expect(cardByCaption('Kiefer').find('input[type="checkbox"]').element.checked).toBe(false)
  })

  test('closing the page asks only when something would be lost', async () => {
    await mountApp()
    await importFile(flatFile, 'woods.json')

    const clean = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(clean)
    expect(clean.defaultPrevented).toBe(false)

    await cards()[0].find('input[type="checkbox"]').setValue(true)
    const dirty = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(dirty)
    expect(dirty.defaultPrevented).toBe(true)
  })

  test('the Info tab renders its text when opened', async () => {
    await mountApp()
    await wrapper.find('#tab-info').trigger('click')
    await vi.waitFor(async () => {
      await flushPromises()
      if (!wrapper.find('.info-panel').exists()) throw new Error('Info panel not loaded yet')
    })
    expect(wrapper.find('.info-panel h1').text().length).toBeGreaterThan(0)
  })
})

// --- Online -----------------------------------------------------------------------------------

const profile = { label: 'Test', baseUrl: 'https://cms.example.org', configPath: '/api/viewer-setting' }
const onlineSettings = {
  version: 1,
  itemsPath: '/api/items',
  hierarchyFields: [],
  fields: { title: { type: 'normal', order: 0 }, description: { type: 'text', order: 1 } },
  itemLabelField: 'title',
}
const serverItems = [
  { id: 1, documentId: 'doc-oak', title: 'Eiche', description: 'Stieleiche' },
  { id: 2, documentId: 'doc-pine', title: 'Kiefer', description: 'Waldkiefer' },
]

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

/** A Strapi stub routed by "METHOD /path" (query ignored); records every request. */
function stubStrapi() {
  const requests = []
  const routes = {
    'GET /api/users/me': () => jsonResponse({ id: 7, username: 'editor' }),
    'GET /api/viewer-setting': () => jsonResponse({ data: { settings: onlineSettings } }),
    'GET /api/items': () =>
      jsonResponse({ data: serverItems, meta: { pagination: { page: 1, pageCount: 1, total: serverItems.length } } }),
    'GET /api/items/doc-pine': () => jsonResponse({ data: serverItems[1] }),
    'PUT /api/items/doc-pine': () => jsonResponse({ data: { ...serverItems[1], title: 'Waldkiefer' } }),
  }
  fetchMock.mockImplementation(async (url, init = {}) => {
    const method = (init.method || 'GET').toUpperCase()
    const { pathname } = new URL(String(url))
    requests.push({ method, pathname, body: init.body ? JSON.parse(init.body) : null })
    const route = routes[`${method} ${pathname}`]
    if (!route) return jsonResponse({ error: { message: `no stub for ${method} ${pathname}` } }, 404)
    return route()
  })
  return requests
}

function startOnlineSession() {
  localStorage.setItem('viewerEditor.connectionProfile.v1', JSON.stringify(profile))
  localStorage.setItem('viewerEditor.appMode.v1', 'online')
  localStorage.setItem('viewerEditor.authToken.v1', 'jwt-test')
}

async function waitForCaptions(expected) {
  await vi.waitFor(async () => {
    await flushPromises()
    expect(cardCaptionsOrRows()).toEqual(expected)
  })
}

// Without a scan field the list shows rows instead of cards.
function cardCaptionsOrRows() {
  const captions = cardCaptions()
  if (captions.length) return captions
  return wrapper.findAll('.item-list-caption').map((node) => node.text())
}

// The wording file is not loaded here (main.js does that), so labels are the inline fallbacks,
// which are German in App.vue and English in some components. Accept either.
function buttonByText(...texts) {
  return wrapper.findAll('button').find((button) => texts.includes(button.text()))
}

describe('App.vue online', () => {
  test('an online session loads the settings, then the items', async () => {
    const requests = stubStrapi()
    startOnlineSession()
    await mountApp()
    await waitForCaptions(['Eiche', 'Kiefer'])

    const paths = requests.map((request) => `${request.method} ${request.pathname}`)
    expect(paths.indexOf('GET /api/viewer-setting')).toBeLessThan(paths.indexOf('GET /api/items'))
  })

  test('saving sends one PUT with only the changed field', async () => {
    const requests = stubStrapi()
    startOnlineSession()
    await mountApp()
    await waitForCaptions(['Eiche', 'Kiefer'])

    await selectByCaption('Kiefer')
    await wrapper.find('#field-title').setValue('Waldkiefer')
    await buttonByText('Änderungen speichern', 'Save changes').trigger('click')
    await vi.waitFor(async () => {
      await flushPromises()
      expect(requests.some((request) => request.method === 'PUT')).toBe(true)
    })

    const puts = requests.filter((request) => request.method === 'PUT')
    expect(puts).toEqual([{ method: 'PUT', pathname: '/api/items/doc-pine', body: { data: { title: 'Waldkiefer' } } }])
  })

  test('logging out with a pending change asks first; cancelling keeps the change (plan 0.2)', async () => {
    stubStrapi()
    startOnlineSession()
    await mountApp()
    await waitForCaptions(['Eiche', 'Kiefer'])
    await selectByCaption('Kiefer')
    await wrapper.find('#field-title').setValue('Waldkiefer')

    globalThis.confirm.mockReturnValueOnce(false)
    await buttonByText('Abmelden', 'Logout').trigger('click')
    await flushPromises()

    expect(globalThis.confirm).toHaveBeenCalledTimes(1)
    expect(buttonByText('Abmelden', 'Logout')).toBeTruthy()
    expect(wrapper.find('#field-title').element.value).toBe('Waldkiefer')

    const unload = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(unload)
    expect(unload.defaultPrevented).toBe(true)
  })
})

async function selectByCaption(caption) {
  const target = cardByCaption(caption) || wrapper.findAll('[role="button"]').find((node) => node.text().includes(caption))
  await target.trigger('click')
  await flushPromises()
}
