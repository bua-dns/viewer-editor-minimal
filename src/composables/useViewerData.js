import { computed, ref } from 'vue'

function uid() {
  if (globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function') {
    return globalThis.crypto.randomUUID()
  }
  return `uid-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function cloneData(data) {
  return JSON.parse(JSON.stringify(data))
}

function toSearchText(item) {
  return Object.values(item)
    .map((value) => String(value ?? '').toLowerCase())
    .join(' ')
}

function tokenize(query) {
  return query
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .filter(Boolean)
}

function isEditableSimpleValue(value) {
  return (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    value === null
  )
}

function parseJsonArray(text) {
  let parsed
  try {
    parsed = JSON.parse(text)
  } catch {
    return { ok: false, error: 'JSON ist ungueltig (Parse-Fehler).' }
  }

  if (!Array.isArray(parsed)) {
    return { ok: false, error: 'Top-Level muss ein JSON-Array sein.' }
  }

  const invalidIndex = parsed.findIndex((item) => !isPlainObject(item))
  if (invalidIndex !== -1) {
    return { ok: false, error: `Element ${invalidIndex + 1} ist kein Objekt.` }
  }

  return { ok: true, data: parsed }
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

function parseCsvText(text) {
  const normalized = text.replace(/^\uFEFF/, '')
  const lines = normalized
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

  if (!lines.length) {
    return { ok: false, error: 'CSV ist leer.' }
  }

  const headerRow = splitCsvLine(lines[0])
  if (!headerRow.length) {
    return { ok: false, error: 'CSV-Header fehlt.' }
  }

  const headers = headerRow.map((header) => {
    const trimmed = String(header || '').trim()
    if (trimmed.toLowerCase() === 'scan') return 'scan'
    return trimmed
  })

  if (headers.some((header) => !header)) {
    return { ok: false, error: 'CSV enthaelt leere Spaltennamen.' }
  }

  const duplicateHeader = headers.find((header, index) => headers.indexOf(header) !== index)
  if (duplicateHeader) {
    return { ok: false, error: `CSV-Spaltenname doppelt: ${duplicateHeader}` }
  }

  const rows = lines.slice(1)
  const data = rows.map((line, rowIndex) => {
    const values = splitCsvLine(line)
    if (values.length > headers.length) {
      throw new Error(`Zeile ${rowIndex + 2} hat mehr Spalten als der Header.`)
    }

    const item = {}
    headers.forEach((header, index) => {
      item[header] = values[index] ?? ''
    })
    return item
  })

  return { ok: true, data }
}

function looksLikeImageUrl(value) {
  if (typeof value !== 'string') return false
  return /^(https?:\/\/).+\.(png|jpe?g|webp|gif|avif)(\?.*)?$/i.test(value.trim())
}

export function useViewerData() {
  const rawItems = ref([])
  const viewItems = ref([])
  const importSnapshot = ref([])

  const selectedUid = ref(null)
  const searchQuery = ref('')
  const isDirty = ref(false)
  const importFileName = ref('')

  const errorMessage = ref('')

  const hasData = computed(() => rawItems.value.length > 0)

  const selectedViewItem = computed(() =>
    viewItems.value.find((item) => item._uid === selectedUid.value) || null,
  )

  const selectedRawItem = computed(() => {
    if (!selectedViewItem.value) return null
    return rawItems.value[selectedViewItem.value._index] || null
  })

  const filteredViewItems = computed(() => {
    const tokens = tokenize(searchQuery.value)
    if (!tokens.length) return viewItems.value
    return viewItems.value.filter((item) =>
      tokens.every((token) => item._searchText.includes(token)),
    )
  })

  function initializeFromJsonArray(items, fileName = '') {
    rawItems.value = cloneData(items)
    importSnapshot.value = cloneData(items)
    viewItems.value = rawItems.value.map((item, index) => ({
      _uid: uid(),
      _index: index,
      _searchText: toSearchText(item),
    }))

    selectedUid.value = null
    searchQuery.value = ''
    isDirty.value = false
    errorMessage.value = ''
    importFileName.value = fileName
  }

  function importFromJsonText(text, fileName = '') {
    const result = parseJsonArray(text)
    if (!result.ok) {
      errorMessage.value = result.error
      return false
    }
    initializeFromJsonArray(result.data, fileName)
    return true
  }

  function importFromCsvText(text, fileName = '') {
    let result
    try {
      result = parseCsvText(text)
    } catch (error) {
      errorMessage.value = error.message || 'CSV ist ungueltig.'
      return false
    }

    if (!result.ok) {
      errorMessage.value = result.error
      return false
    }

    initializeFromJsonArray(result.data, fileName)
    return true
  }

  function selectItem(uidValue) {
    selectedUid.value = uidValue
  }

  function updateField(key, nextRawValue) {
    if (!selectedViewItem.value) return false

    const itemIndex = selectedViewItem.value._index
    const item = rawItems.value[itemIndex]
    if (!item || !Object.prototype.hasOwnProperty.call(item, key)) return false
    if (!isEditableSimpleValue(item[key])) return false

    let normalizedValue = nextRawValue
    if (typeof item[key] === 'number') {
      const parsedNumber = Number(nextRawValue)
      if (Number.isNaN(parsedNumber)) return false
      normalizedValue = parsedNumber
    } else if (typeof item[key] === 'boolean') {
      normalizedValue = Boolean(nextRawValue)
    } else if (item[key] === null) {
      normalizedValue = nextRawValue === '' ? null : nextRawValue
    }

    item[key] = normalizedValue
    selectedViewItem.value._searchText = toSearchText(item)
    isDirty.value = true
    return true
  }

  function resetToImportedSnapshot() {
    if (!importSnapshot.value.length) return false
    const fileName = importFileName.value
    initializeFromJsonArray(cloneData(importSnapshot.value), fileName)
    return true
  }

  function createExportPayload() {
    return cloneData(rawItems.value)
  }

  function markAsSaved(nextFileName = '') {
    importSnapshot.value = cloneData(rawItems.value)
    importFileName.value = nextFileName || importFileName.value
    isDirty.value = false
    return true
  }

  return {
    rawItems,
    viewItems,
    importSnapshot,
    selectedUid,
    searchQuery,
    isDirty,
    importFileName,
    errorMessage,
    hasData,
    selectedViewItem,
    selectedRawItem,
    filteredViewItems,
    initializeFromJsonArray,
    importFromJsonText,
    importFromCsvText,
    selectItem,
    updateField,
    resetToImportedSnapshot,
    createExportPayload,
    markAsSaved,
    isEditableSimpleValue,
    looksLikeImageUrl,
  }
}

export const __test = {
  parseJsonArray,
  parseCsvText,
  splitCsvLine,
  tokenize,
  toSearchText,
  isEditableSimpleValue,
  looksLikeImageUrl,
}
