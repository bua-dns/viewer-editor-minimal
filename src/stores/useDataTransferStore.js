import { computed, ref } from 'vue'

const DATA_MODE_SESSION_KEY = 'viewerEditor.dataMode.v1'

const appendEditedTimestamp = ref(true)
const dataMode = ref('json')
const modeErrorMessage = ref('')

const uploadAccept = computed(() => (dataMode.value === 'csv' ? '.csv,text/csv' : '.json,application/json'))

// A browser that blocks site storage throws on access; the data mode then just isn't remembered
// (review F3). Same pattern as the localStorage access in the other stores.
function getSessionStorageSafe() {
  try {
    return globalThis.sessionStorage || null
  } catch {
    return null
  }
}

function readStoredDataMode() {
  try {
    return getSessionStorageSafe()?.getItem(DATA_MODE_SESSION_KEY) ?? null
  } catch {
    return null
  }
}

function storeDataMode(mode) {
  try {
    getSessionStorageSafe()?.setItem(DATA_MODE_SESSION_KEY, mode)
  } catch {
    // Not remembered for this session; the mode still applies.
  }
}

function loadDataModeFromSession() {
  const stored = readStoredDataMode()
  if (stored === 'json' || stored === 'csv') {
    dataMode.value = stored
  }
}

function setDataMode(nextMode) {
  if (nextMode !== 'json' && nextMode !== 'csv') return false
  if (nextMode === dataMode.value) return false
  dataMode.value = nextMode
  modeErrorMessage.value = ''
  storeDataMode(nextMode)
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
