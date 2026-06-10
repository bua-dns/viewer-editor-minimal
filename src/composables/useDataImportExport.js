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
    onReset,
  }
}
