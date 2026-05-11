import { computed, ref } from 'vue'

const DATA_MODE_SESSION_KEY = 'viewerEditor.dataMode.v1'

const appendEditedTimestamp = ref(true)
const dataMode = ref('json')
const modeErrorMessage = ref('')

const uploadAccept = computed(() => (dataMode.value === 'csv' ? '.csv,text/csv' : '.json,application/json'))

function loadDataModeFromSession() {
  const stored = sessionStorage.getItem(DATA_MODE_SESSION_KEY)
  if (stored === 'json' || stored === 'csv') {
    dataMode.value = stored
  }
}

function setDataMode(nextMode) {
  if (nextMode !== 'json' && nextMode !== 'csv') return false
  if (nextMode === dataMode.value) return false
  dataMode.value = nextMode
  modeErrorMessage.value = ''
  sessionStorage.setItem(DATA_MODE_SESSION_KEY, nextMode)
  return true
}

function detectUploadType(fileName) {
  const lower = fileName.toLowerCase()
  if (lower.endsWith('.json')) return 'json'
  if (lower.endsWith('.csv')) return 'csv'
  return 'unknown'
}

async function processUploadFile(file, { importFromJsonText, importFromCsvText, t }) {
  const detectedType = detectUploadType(file.name)
  if (detectedType !== dataMode.value) {
    modeErrorMessage.value = t('uploadModeMismatchError', 'Dateityp passt nicht zum gewaehlten Modus.')
    return false
  }

  const text = await file.text()
  modeErrorMessage.value = ''

  if (dataMode.value === 'csv') {
    return importFromCsvText(text, file.name)
  }

  return importFromJsonText(text, file.name)
}

function downloadDataPayload(payload, importFileName, markAsSaved) {
  const isCsvMode = dataMode.value === 'csv'
  const fileExtension = isCsvMode ? '.csv' : '.json'
  const output = isCsvMode ? String(payload ?? '') : JSON.stringify(payload, null, 2)
  const mimeType = isCsvMode ? 'text/csv' : 'application/json'
  const blob = new Blob([output], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  const importedBaseName = importFileName ? importFileName.replace(/\.(json|csv)$/i, '') : 'data'
  const baseName = importedBaseName.replace(/-edited(?:-\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2})?$/i, '')
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19)
  link.href = url
  link.download = appendEditedTimestamp.value
    ? `${baseName}-edited-${timestamp}${fileExtension}`
    : `${baseName}-edited${fileExtension}`
  const downloadFileName = link.download
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)

  if (appendEditedTimestamp.value) {
    markAsSaved(downloadFileName)
  }
}

export function useDataTransferStore() {
  return {
    appendEditedTimestamp,
    dataMode,
    modeErrorMessage,
    uploadAccept,
    loadDataModeFromSession,
    setDataMode,
    processUploadFile,
    downloadDataPayload,
  }
}
