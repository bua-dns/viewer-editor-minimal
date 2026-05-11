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
  isDirty,
  resetToImportedSnapshot,
}) {
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
    triggerBrowserDownload(JSON.stringify(payload, null, 2), 'application/json', downloadFileName)
    if (appendEditedTimestamp.value) {
      markAsSaved(downloadFileName)
    }
  }

  function onReset() {
    if (!isDirty.value) return
    const confirmed = globalThis.confirm(t('resetConfirm', 'Aenderungen verwerfen und auf Import zuruecksetzen?'))
    if (!confirmed) return
    resetToImportedSnapshot()
  }

  return {
    onDataFileSelected,
    onDownload,
    onReset,
  }
}
