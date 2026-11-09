import { nextTick } from 'vue'
import { parseCsvRecords } from './csvFormat'

export function useDataImportExport({
  dataMode,
  t,
  setModeErrorMessage,
  importFromCsvText,
  importFromJsonText,
  initializeUserConfigForCurrentData,
  importedConfig,
  applyImportedConfigPayload,
  applyUserConfigToRawItems,
  rawItems,
  errorMessage,
  createEditedFileName,
  importFileName,
  createCsvExportText,
  appendEditedTimestamp,
  markAsSaved,
  createExportPayload,
  createSuspendedItemsPayload,
  createUserConfigPayload,
  createReplacementsPayload,
  isDirty,
  hasPendingChanges,
  hasUnappliedUserConfigChanges,
  resetToImportedSnapshot,
  resetReplacements,
  dataSourceViewerSettings = { value: {} },
  setDataSourceViewerSettings = () => {},
}) {
  const baseUrl = import.meta.env.BASE_URL || '/'

  function resolvePublicAssetUrl(path) {
    const normalized = String(path || '').replace(/^\/+/, '')
    const normalizedBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`
    return `${normalizedBase}${normalized}`
  }

  function normalizeSampleScanUrls() {
    rawItems.value.forEach((item) => {
      if (!item || typeof item.scan !== 'string') return
      const scanValue = item.scan.trim()
      if (!scanValue.startsWith('/')) return
      item.scan = resolvePublicAssetUrl(scanValue)
    })
  }

  function detectDataFileType(fileName) {
    const lowerFileName = fileName.toLowerCase()
    if (lowerFileName.endsWith('.json')) return 'json'
    if (lowerFileName.endsWith('.csv')) return 'csv'
    return 'unknown'
  }

  function isValidAbsoluteHttpUrl(value) {
    try {
      const parsed = new URL(value)
      return parsed.protocol === 'http:' || parsed.protocol === 'https:'
    } catch {
      return false
    }
  }

  function collectUrlsFromCsvText(csvText) {
    let records
    try {
      records = parseCsvRecords(csvText)
    } catch (error) {
      return { ok: false, error: error.message }
    }

    if (!records.length) {
      return { ok: false, error: t('startFromScratchCsvEmpty', 'CSV ist leer.') }
    }

    const headerCells = records[0].cells.map((cell) => String(cell || '').trim().toLowerCase())
    const scanColumnIndex = headerCells.indexOf('scan')
    const dataRecords = scanColumnIndex === -1 ? records : records.slice(1)

    const scannedRows = dataRecords
      .map(({ cells, lineNumber }) => ({
        rowNumber: lineNumber,
        url: String((scanColumnIndex === -1 ? cells[0] : cells[scanColumnIndex]) || '').trim(),
      }))
      .filter((entry) => entry.url)

    if (!scannedRows.length) {
      return { ok: false, error: t('startFromScratchNoUrls', 'Keine URLs im CSV gefunden.') }
    }

    const invalidEntry = scannedRows.find((entry) => !isValidAbsoluteHttpUrl(entry.url))
    if (invalidEntry) {
      return {
        ok: false,
        error: `${t('startFromScratchScanInvalidRow', 'Ungueltige URL in Zeile')} ${invalidEntry.rowNumber}: ${invalidEntry.url}`,
      }
    }

    return { ok: true, urls: scannedRows.map((entry) => entry.url) }
  }

  function collectStartFromScratchUrls(input = {}) {
    if (input.mode === 'csv') {
      return collectUrlsFromCsvText(input.csvText)
    }

    const singleUrl = String(input.singleUrl || '').trim()
    if (!isValidAbsoluteHttpUrl(singleUrl)) {
      return {
        ok: false,
        error: t('startFromScratchScanInvalid', 'Ungueltige URL. Bitte eine absolute http/https-URL eingeben.'),
      }
    }

    return { ok: true, urls: [singleUrl] }
  }

  // Carries a field config drafted in the Konfiguration tab before any data existed.
  function createStartFromScratchPayload(scanUrls) {
    return {
      data: scanUrls.map((scanUrl) => ({ scan: scanUrl })),
      config: {
        ...createUserConfigPayload(),
        ...dataSourceViewerSettings.value,
      },
      replacements: {
        allFields: {},
      },
    }
  }

  function isSelectedFileTypeMatchingMode(fileName) {
    return detectDataFileType(fileName) === dataMode.value
  }

  function parseDataFileContent(text, fileName) {
    if (dataMode.value === 'csv') {
      return importFromCsvText(text, fileName)
    }
    return importFromJsonText(text, fileName)
  }

  // Every import opens a new data source: its viewer settings replace the previous ones,
  // and an import without a (valid) config falls back to the basic config.
  async function applyImportedConfigIfPresent() {
    if (dataMode.value !== 'json' || !importedConfig.value) {
      setDataSourceViewerSettings({})
      return true
    }

    const applyResult = applyImportedConfigPayload(importedConfig.value)
    if (!applyResult.ok) {
      setDataSourceViewerSettings({})
      errorMessage.value = applyResult.error
      return false
    }

    setDataSourceViewerSettings(importedConfig.value)

    applyUserConfigToRawItems(rawItems.value)
    await nextTick()
    return true
  }

  // A new data source replaces the field config, except when no data was loaded before and the
  // new data brings no config of its own: then a config drafted in the Konfiguration tab is kept
  // and applied to the items.
  function prepareFieldConfigForNewData(hadDataBefore) {
    const bringsConfig = dataMode.value === 'json' && Boolean(importedConfig.value)
    if (!hadDataBefore && !bringsConfig) {
      applyUserConfigToRawItems(rawItems.value)
      return
    }
    initializeUserConfigForCurrentData()
  }

  async function onDataFileSelected(file) {
    if (!isSelectedFileTypeMatchingMode(file.name)) {
      setModeErrorMessage(t('uploadModeMismatchError', 'Dateityp passt nicht zum gewaehlten Modus.'))
      return
    }

    const text = await file.text()
    setModeErrorMessage('')
    const hadDataBefore = rawItems.value.length > 0
    const success = parseDataFileContent(text, file.name)
    if (!success) return

    prepareFieldConfigForNewData(hadDataBefore)
    await applyImportedConfigIfPresent()
  }

  async function onLoadSampleData() {
    const samplePath = dataMode.value === 'csv'
      ? resolvePublicAssetUrl('sample-data.csv')
      : resolvePublicAssetUrl('sample-data.json')
    const sampleFileName = dataMode.value === 'csv' ? 'sample-data.csv' : 'sample-data.json'

    try {
      setModeErrorMessage('')
      errorMessage.value = ''
      const response = await fetch(samplePath)
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const text = await response.text()
      const hadDataBefore = rawItems.value.length > 0
      const success = parseDataFileContent(text, sampleFileName)
      if (!success) return

      normalizeSampleScanUrls()

      prepareFieldConfigForNewData(hadDataBefore)
      await applyImportedConfigIfPresent()
    } catch {
      errorMessage.value = t('sampleDataLoadError', 'Beispieldaten konnten nicht geladen werden.')
    }
  }

  function triggerBrowserDownload(content, mimeType, fileName) {
    const blob = new Blob([content], { type: mimeType })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = fileName
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  function applyPendingUserConfigBeforeExport() {
    if (!hasUnappliedUserConfigChanges.value) return
    applyUserConfigToRawItems(rawItems.value)
  }

  function onDownload() {
    applyPendingUserConfigBeforeExport()

    const extension = dataMode.value === 'csv' ? '.csv' : '.json'
    const downloadFileName = createEditedFileName(importFileName.value, extension)

    if (dataMode.value === 'csv') {
      triggerBrowserDownload(createCsvExportText(), 'text/csv', downloadFileName)
      if (appendEditedTimestamp.value) {
        markAsSaved(downloadFileName)
      }
      return
    }

    const payload = {
      data: createExportPayload(),
      config: { ...createUserConfigPayload(), ...dataSourceViewerSettings.value },
      suspendedItems: createSuspendedItemsPayload(),
    }
    payload.replacements = createReplacementsPayload()
    triggerBrowserDownload(JSON.stringify(payload, null, 2), 'application/json', downloadFileName)
    if (appendEditedTimestamp.value) {
      markAsSaved(downloadFileName)
    }
  }

  async function onStartFromScratch(input = {}) {
    if (dataMode.value !== 'json') return

    const urlsResult = collectStartFromScratchUrls(input)
    if (!urlsResult.ok) {
      return urlsResult
    }

    const payload = createStartFromScratchPayload(urlsResult.urls)
    const payloadText = JSON.stringify(payload, null, 2)
    const fileName = createEditedFileName('dataset.viewer-ready.json', '.json')

    setModeErrorMessage('')
    const success = importFromJsonText(payloadText, fileName)
    if (!success) {
      return { ok: false, error: errorMessage.value }
    }

    initializeUserConfigForCurrentData()
    await applyImportedConfigIfPresent()
    isDirty.value = true
    return { ok: true }
  }

  function onReset() {
    if (!hasPendingChanges.value) return false
    const confirmed = globalThis.confirm(t('resetConfirm', 'Aenderungen verwerfen und auf Import zuruecksetzen?'))
    if (!confirmed) return false
    resetToImportedSnapshot()
    resetReplacements()
    return true
  }

  return {
    onDataFileSelected,
    onLoadSampleData,
    onDownload,
    onStartFromScratch,
    onReset,
  }
}
