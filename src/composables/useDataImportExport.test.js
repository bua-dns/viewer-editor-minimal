import { beforeEach, afterEach, describe, expect, test, vi } from 'vitest'
import { ref } from 'vue'
import { useDataImportExport } from './useDataImportExport'

function createBrowserMock() {
  const link = {
    click: vi.fn(),
    href: '',
    download: '',
  }

  globalThis.URL.createObjectURL = vi.fn(() => 'blob:mock')
  globalThis.URL.revokeObjectURL = vi.fn()
  globalThis.document = {
    createElement: vi.fn(() => link),
    body: {
      appendChild: vi.fn(),
      removeChild: vi.fn(),
    },
  }
}

function createModel({ dataMode = 'json', hasUnapplied = false, log = [] } = {}) {
  const rawItems = ref([{ scan: 'https://example.com/a.jpg' }])

  return useDataImportExport({
    dataMode: ref(dataMode),
    t: (key, fallback) => fallback || key,
    setModeErrorMessage: vi.fn(),
    importFromCsvText: vi.fn(),
    importFromJsonText: vi.fn(),
    initializeUserConfigForCurrentData: vi.fn(),
    importedConfig: ref(null),
    applyImportedConfigPayload: vi.fn(() => ({ ok: true })),
    applyUserConfigToRawItems: vi.fn(() => {
      log.push('apply')
    }),
    rawItems,
    errorMessage: ref(''),
    createEditedFileName: vi.fn((name, ext) => `${name}${ext}`),
    importFileName: ref('dataset'),
    createCsvExportText: vi.fn(() => {
      log.push('csv')
      return 'scan\nhttps://example.com/a.jpg'
    }),
    appendEditedTimestamp: ref(false),
    markAsSaved: vi.fn(),
    createExportPayload: vi.fn(() => {
      log.push('data')
      return rawItems.value
    }),
    createUserConfigPayload: vi.fn(() => {
      log.push('config')
      return { version: 1, fields: {} }
    }),
    createReplacementsPayload: vi.fn(() => {
      log.push('replacements')
      return { allFields: {} }
    }),
    isDirty: ref(false),
    hasPendingChanges: ref(false),
    hasUnappliedUserConfigChanges: ref(hasUnapplied),
    resetToImportedSnapshot: vi.fn(),
    resetReplacements: vi.fn(),
  })
}

describe('useDataImportExport download flow', () => {
  const originalDocument = globalThis.document
  const originalCreateObjectUrl = globalThis.URL.createObjectURL
  const originalRevokeObjectUrl = globalThis.URL.revokeObjectURL

  beforeEach(() => {
    createBrowserMock()
  })

  afterEach(() => {
    globalThis.document = originalDocument
    globalThis.URL.createObjectURL = originalCreateObjectUrl
    globalThis.URL.revokeObjectURL = originalRevokeObjectUrl
  })

  test('auto-applies pending config before JSON export', () => {
    const log = []
    const model = createModel({ dataMode: 'json', hasUnapplied: true, log })

    model.onDownload()

    expect(log).toEqual(['apply', 'data', 'config', 'replacements'])
  })

  test('auto-applies pending config before CSV export', () => {
    const log = []
    const model = createModel({ dataMode: 'csv', hasUnapplied: true, log })

    model.onDownload()

    expect(log).toEqual(['apply', 'csv'])
  })
})
