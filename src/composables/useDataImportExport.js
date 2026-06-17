import { nextTick } from 'vue'

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
  createUserConfigPayload,
  createReplacementsPayload,
  isDirty,
  hasPendingChanges,
  resetToImportedSnapshot,
  resetReplacements,
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

  function splitCsvLine(line, delimiter = ',') {
    const values = []
    let current = ''
    let inQuotes = false

    for (let i = 0; i < line.length; i += 1) {
      const char = line[i]
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"'
          i += 1
        } else {
          inQuotes = !inQuotes
        }
        continue
      }

      if (char === delimiter && !inQuotes) {
        values.push(current)
        current = ''
        continue
      }

      current += char
    }

    values.push(current)
    return values
  }

  function collectUrlsFromCsvText(csvText) {
    const lines = String(csvText || '')
      .replace(/^\uFEFF/, '')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)

    if (!lines.length) {
      return { ok: false, error: t('startFromScratchCsvEmpty', 'CSV ist leer.') }
    }

    const rows = lines.map((line) => splitCsvLine(line))
    const headerCells = rows[0].map((cell) => String(cell || '').trim().toLowerCase())
    const scanColumnIndex = headerCells.indexOf('scan')
    const dataRows = scanColumnIndex === -1 ? rows : rows.slice(1)
    const rowOffset = scanColumnIndex === -1 ? 1 : 2

    const scannedRows = dataRows
      .map((row, rowIndex) => {
        const cellValue = scanColumnIndex === -1 ? row[0] : row[scanColumnIndex]
        return {
          rowNumber: rowIndex + rowOffset,
          url: String(cellValue || '').trim(),
        }
      })
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

  function createStartFromScratchPayload(scanUrls) {
    return {
      data: scanUrls.map((scanUrl) => ({ scan: scanUrl })),
      config: {
        version: 1,
        fields: {},
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

  async function applyImportedConfigIfPresent() {
    if (dataMode.value !== 'json' || !importedConfig.value) return true

    const applyResult = applyImportedConfigPayload(importedConfig.value)
    if (!applyResult.ok) {
      errorMessage.value = applyResult.error
      return false
    }

    applyUserConfigToRawItems(rawItems.value)
    await nextTick()
    return true
  }

  async function onDataFileSelected(file) {
    if (!isSelectedFileTypeMatchingMode(file.name)) {
      setModeErrorMessage(t('uploadModeMismatchError', 'Dateityp passt nicht zum gewaehlten Modus.'))
      return
    }

    const text = await file.text()
    setModeErrorMessage('')
    const success = parseDataFileContent(text, file.name)
    if (!success) return

    initializeUserConfigForCurrentData()
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
      const success = parseDataFileContent(text, sampleFileName)
      if (!success) return

      normalizeSampleScanUrls()

      initializeUserConfigForCurrentData()
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

  function onDownload() {
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
      config: createUserConfigPayload(),
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
    if (!hasPendingChanges.value) return
    const confirmed = globalThis.confirm(t('resetConfirm', 'Aenderungen verwerfen und auf Import zuruecksetzen?'))
    if (!confirmed) return
    resetToImportedSnapshot()
    resetReplacements()
  }

  return {
    onDataFileSelected,
    onLoadSampleData,
    onDownload,
    onStartFromScratch,
    onReset,
  }
}
