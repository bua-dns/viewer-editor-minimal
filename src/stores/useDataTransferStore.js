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
    importFromCsvText(text, file.name)
    return true
  }

  importFromJsonText(text, file.name)
  return true
}

function downloadDataPayload(payload, importFileName, markAsSaved) {
  const json = JSON.stringify(payload, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  const importedBaseName = importFileName ? importFileName.replace(/\.json$/i, '') : 'data'
  const baseName = importedBaseName.replace(/-edited(?:-\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2})?$/i, '')
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19)
  link.href = url
  link.download = appendEditedTimestamp.value ? `${baseName}-edited-${timestamp}.json` : `${baseName}-edited.json`
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
