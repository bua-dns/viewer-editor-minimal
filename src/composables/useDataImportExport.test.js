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

function createModel({ dataMode = 'json', hasUnapplied = false, log = [], overrides = {} } = {}) {
  const rawItems = ref([{ scan: 'https://example.com/a.jpg' }])

  return useDataImportExport({
    dataMode: ref(dataMode),
    t: (key, fallback) => fallback || key,
    setModeErrorMessage: vi.fn(),
    importFromCsvText: vi.fn(),
    importFromJsonText: vi.fn(),
    clearUserConfigSession: vi.fn(),
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
    createSuspendedItemsPayload: vi.fn(() => {
      log.push('suspended')
      return [0]
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
    ...overrides,
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

    expect(log).toEqual(['apply', 'data', 'config', 'suspended', 'replacements'])
  })

  test('auto-applies pending config before CSV export', () => {
    const log = []
    const model = createModel({ dataMode: 'csv', hasUnapplied: true, log })

    model.onDownload()

    expect(log).toEqual(['apply', 'csv'])
  })

  test('writes the data source viewer settings into the exported config', async () => {
    const blobParts = []
    const OriginalBlob = globalThis.Blob
    globalThis.Blob = class {
      constructor(parts) {
        blobParts.push(...parts)
      }
    }

    try {
      const model = createModel({
        overrides: { dataSourceViewerSettings: ref({ primaryColor: '#123456', languageMode: 'single' }) },
      })
      model.onDownload()
    } finally {
      globalThis.Blob = OriginalBlob
    }

    const exported = JSON.parse(blobParts.join(''))
    expect(exported.config).toEqual({ version: 1, fields: {}, primaryColor: '#123456', languageMode: 'single' })
  })
})

describe('useDataImportExport viewer settings on import', () => {
  function createFile(name, text = '[]') {
    return { name, text: async () => text }
  }

  test('takes the viewer settings from an imported JSON config', async () => {
    const setDataSourceViewerSettings = vi.fn()
    const importedConfig = ref({ version: 1, fields: {}, primaryColor: '#abcdef' })
    const model = createModel({
      overrides: {
        importFromJsonText: vi.fn(() => true),
        importedConfig,
        setDataSourceViewerSettings,
      },
    })

    await model.onDataFileSelected(createFile('data.json'))

    expect(setDataSourceViewerSettings).toHaveBeenLastCalledWith(importedConfig.value)
  })

  test('falls back to the basic config for a CSV import', async () => {
    const setDataSourceViewerSettings = vi.fn()
    const model = createModel({
      dataMode: 'csv',
      overrides: {
        importFromCsvText: vi.fn(() => true),
        setDataSourceViewerSettings,
      },
    })

    await model.onDataFileSelected(createFile('data.csv', 'a,b'))

    expect(setDataSourceViewerSettings).toHaveBeenLastCalledWith({})
  })

  test('falls back to the basic config when the imported config is invalid', async () => {
    const setDataSourceViewerSettings = vi.fn()
    const model = createModel({
      overrides: {
        importFromJsonText: vi.fn(() => true),
        importedConfig: ref({ primaryColor: '#abcdef' }),
        applyImportedConfigPayload: vi.fn(() => ({ ok: false, error: 'invalid' })),
        setDataSourceViewerSettings,
      },
    })

    await model.onDataFileSelected(createFile('data.json'))

    expect(setDataSourceViewerSettings).toHaveBeenLastCalledWith({})
  })
})
