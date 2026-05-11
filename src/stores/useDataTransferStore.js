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

function setModeErrorMessage(message) {
  modeErrorMessage.value = message || ''
}

function createEditedFileName(importFileName = '', extension = '.json') {
  const importedBaseName = importFileName ? importFileName.replace(/\.(json|csv)$/i, '') : 'data'
  const baseName = importedBaseName.replace(/-edited(?:-\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2})?$/i, '')
  if (!appendEditedTimestamp.value) return `${baseName}-edited${extension}`
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19)
  return `${baseName}-edited-${timestamp}${extension}`
}

export function useDataTransferStore() {
  return {
    appendEditedTimestamp,
    dataMode,
    modeErrorMessage,
    uploadAccept,
    loadDataModeFromSession,
    setDataMode,
    setModeErrorMessage,
    createEditedFileName,
  }
}
