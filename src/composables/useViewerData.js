import { computed, ref, unref } from 'vue'
import { useReplacementsStore } from '../stores/useReplacementsStore'
import { normalizeUpdatedFieldValue } from '../fields/fieldRegistry'

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

function parseJsonPayload(text) {
  let parsed
  try {
    parsed = JSON.parse(text)
  } catch {
    return { ok: false, error: 'JSON ist ungueltig (Parse-Fehler).' }
  }

  const hasDataObject = isPlainObject(parsed) && Object.prototype.hasOwnProperty.call(parsed, 'data')
  const rawData = hasDataObject ? parsed.data : parsed

  if (!Array.isArray(rawData)) {
    if (hasDataObject) {
      return { ok: false, error: 'JSON-Feld "data" muss ein Array sein.' }
    }
    return { ok: false, error: 'Top-Level muss ein JSON-Array sein.' }
  }

  const invalidIndex = rawData.findIndex((item) => !isPlainObject(item))
  if (invalidIndex !== -1) {
    return { ok: false, error: `Element ${invalidIndex + 1} ist kein Objekt.` }
  }

  const hasConfigProperty = hasDataObject && Object.prototype.hasOwnProperty.call(parsed, 'config')
  if (hasConfigProperty && !isPlainObject(parsed.config)) {
    return { ok: false, error: 'JSON-Feld "config" muss ein Objekt sein.' }
  }

  const configFromPayload = hasConfigProperty ? parsed.config : null

  const hasReplacementsProperty = hasDataObject && Object.prototype.hasOwnProperty.call(parsed, 'replacements')
  if (hasReplacementsProperty && !isPlainObject(parsed.replacements)) {
    return { ok: false, error: 'JSON-Feld "replacements" muss ein Objekt sein.' }
  }

  const replacementsFromPayload = hasReplacementsProperty ? parsed.replacements : null

  return {
    ok: true,
    data: rawData,
    hasConfig: configFromPayload !== null,
    config: configFromPayload,
    hasReplacements: replacementsFromPayload !== null,
    replacements: replacementsFromPayload,
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

function parseCsvText(text) {
  const normalized = text.replace(/^\uFEFF/, '')
  const lines = normalized
    .split('\n')
    .map((line) => (line.endsWith('\r') ? line.slice(0, -1) : line))
    .filter((line) => line.length > 0)

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
  return /^(?:https?:\/\/|\/).+\.(png|jpe?g|webp|gif|avif)(\?.*)?$/i.test(value.trim())
}

function toCsvCell(value) {
  const text = String(value ?? '')
  if (/[,"\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`
  }
  return text
}

function createCsvTextFromItems(items) {
  if (!Array.isArray(items) || items.length === 0) return ''
  const headers = []
  const seen = new Set()
  items.forEach((item) => {
    Object.keys(item || {}).forEach((key) => {
      if (!seen.has(key)) {
        headers.push(key)
        seen.add(key)
      }
    })
  })

  if (!headers.length) return ''

  const lines = []
  lines.push(headers.map((header) => toCsvCell(header)).join(','))
  items.forEach((item) => {
    lines.push(headers.map((header) => toCsvCell(item?.[header])).join(','))
  })

  return lines.join('\n')
}

export function useViewerData(options = {}) {
  const rawItems = ref([])
  const viewItems = ref([])
  const importSnapshot = ref([])
  const itemLabelFieldRef = options.itemLabelField
  const markAsEditedBasisRef = options.markAsEditedBasis
  const markAsEditedItemsFirstRef = options.markAsEditedItemsFirst

  const selectedUid = ref(null)
  const searchQuery = ref('')
  const isDirty = ref(false)
  const importFileName = ref('')
  const importedConfig = ref(null)

  const { initializeReplacements, clearReplacements } = useReplacementsStore()

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
    const normalizedQuery = String(searchQuery.value || '').trim().toLowerCase()
    const tokens = normalizedQuery.length > 2 ? tokenize(normalizedQuery) : []

    const itemLabelField = String(unref(itemLabelFieldRef) || '').trim()
    const editedBasisField = String(unref(markAsEditedBasisRef) || '').trim()
    const editedItemsFirst = Boolean(unref(markAsEditedItemsFirstRef))
    const matches = []

    viewItems.value.forEach((item, orderIndex) => {
      if (tokens.length && !tokens.every((token) => item._searchText.includes(token))) return

      const rawItem = rawItems.value[item._index] || {}
      const labelValue = itemLabelField ? rawItem[itemLabelField] : ''
      const labelText = String(labelValue ?? '').toLowerCase()
      const labelMatchScore = tokens.length
        ? tokens.reduce((score, token) => (labelText.includes(token) ? score + 1 : score), 0)
        : 0
      const editedBasisValue = editedBasisField ? rawItem[editedBasisField] : null
      const isEdited = hasNonEmptyValue(editedBasisValue)

      matches.push({
        item,
        isEdited,
        labelMatchScore,
        orderIndex,
      })
    })

    matches.sort((a, b) => {
      if (a.isEdited !== b.isEdited) {
        return editedItemsFirst ? (a.isEdited ? -1 : 1) : a.isEdited ? 1 : -1
      }
      if (b.labelMatchScore !== a.labelMatchScore) {
        return b.labelMatchScore - a.labelMatchScore
      }
      return a.orderIndex - b.orderIndex
    })

    return matches.map((entry) => entry.item)
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
    importedConfig.value = null
  }

  function importFromJsonText(text, fileName = '') {
    const result = parseJsonPayload(text)
    if (!result.ok) {
      errorMessage.value = result.error
      clearReplacements()
      return false
    }
    initializeFromJsonArray(result.data, fileName)
    importedConfig.value = result.hasConfig ? cloneData(result.config) : null
    initializeReplacements(result.replacements)
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
      clearReplacements()
      return false
    }

    initializeFromJsonArray(result.data, fileName)
    importedConfig.value = null
    clearReplacements()
    return true
  }

  function selectItem(uidValue) {
    selectedUid.value = uidValue
  }

  function updateField(key, nextRawValue, configuredType = null) {
    if (!selectedViewItem.value) return false

    const itemIndex = selectedViewItem.value._index
    const item = rawItems.value[itemIndex]
    if (!item || !Object.prototype.hasOwnProperty.call(item, key)) return false

    const isStructuredField = configuredType === 'wikidata-autosuggest'
    if (!isStructuredField && !isEditableSimpleValue(item[key])) return false

    const normalization = normalizeUpdatedFieldValue(item[key], nextRawValue, configuredType)
    if (!normalization.ok) return false

    item[key] = normalization.value
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

  function createCsvExportText() {
    return createCsvTextFromItems(rawItems.value)
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
    importedConfig,
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
    createCsvExportText,
    markAsSaved,
    isEditableSimpleValue,
    looksLikeImageUrl,
  }
}

function hasNonEmptyValue(value) {
  if (value == null) return false
  if (typeof value === 'string') return value.trim().length > 0
  if (Array.isArray(value)) return value.length > 0
  if (typeof value === 'object') return Object.keys(value).length > 0
  return true
}

export const __test = {
  parseJsonPayload,
  parseCsvText,
  createCsvTextFromItems,
  splitCsvLine,
  tokenize,
  toSearchText,
  isEditableSimpleValue,
  looksLikeImageUrl,
}
