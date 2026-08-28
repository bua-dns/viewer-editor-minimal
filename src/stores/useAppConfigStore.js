import { computed, ref } from 'vue'
import appConfig from '../../config/app.config'

const APP_CONFIG_STORAGE_KEY = 'viewerEditor.appConfig.v1'

const language = ref(appConfig.language || 'de')
const onlineWording = ref({})
const localWordingOverrideKeys = new Set(['tabDatabaseConnection', 'dbConnectionOpenTab'])

function normalizeLanguageMode(value) {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
  return normalized === 'single' ? 'single' : 'multi'
}

function normalizeGithubRepoUrl(value) {
  return String(value || '').trim()
}

function normalizeDefaultConnectionProfile(value) {
  return String(value || '').trim()
}

function normalizeConnectionMode(value) {
  if (value === 'offline' || value === 'online' || value === 'switchable') {
    return value
  }
  return 'switchable'
}

function normalizePrimaryColor(value) {
  const normalized = String(value || '').trim()
  return normalized || '#0066CC'
}

function normalizeLanguage(value) {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
  return normalized || 'de'
}

function normalizeAppConfigInput(input = {}) {
  const source = isPlainObject(input) ? input : {}
  return {
    language: normalizeLanguage(source.language),
    languageMode: normalizeLanguageMode(source.languageMode),
    githubRepo: normalizeGithubRepoUrl(source.githubRepo),
    primaryColor: normalizePrimaryColor(source.primaryColor),
    connectionMode: normalizeConnectionMode(source.connectionMode),
    dataInspectionMode: Boolean(source.dataInspectionMode),
    defaultConnectionProfile: normalizeDefaultConnectionProfile(source.defaultConnectionProfile),
  }
}

function createEditableConfigSnapshot(input = {}) {
  const normalized = normalizeAppConfigInput(input)
  return {
    version: 1,
    ...normalized,
    updatedAt: new Date().toISOString(),
  }
}

function getLocalStorageSafe() {
  try {
    return globalThis.localStorage
  } catch {
    return null
  }
}

const defaultEditableConfig = normalizeAppConfigInput(appConfig)
const editableConfig = ref({
  ...defaultEditableConfig,
  updatedAt: '',
})

function applyEditableConfigSnapshot(input = {}) {
  const normalized = normalizeAppConfigInput(input)
  editableConfig.value = {
    ...editableConfig.value,
    ...normalized,
    updatedAt: String(input.updatedAt || editableConfig.value.updatedAt || '').trim(),
  }
  language.value = normalized.language
}

function loadEditableAppConfigFromStorage() {
  const storage = getLocalStorageSafe()
  if (!storage) {
    return { ok: false, reason: 'storage-unavailable' }
  }

  const raw = storage.getItem(APP_CONFIG_STORAGE_KEY)
  if (!raw) {
    applyEditableConfigSnapshot(defaultEditableConfig)
    return { ok: true, hasConfig: false }
  }

  try {
    const parsed = JSON.parse(raw)
    applyEditableConfigSnapshot(parsed)
    return { ok: true, hasConfig: true, config: editableConfig.value }
  } catch {
    applyEditableConfigSnapshot(defaultEditableConfig)
    return { ok: false, reason: 'invalid-json' }
  }
}

function saveEditableAppConfig(input = {}) {
  const storage = getLocalStorageSafe()
  if (!storage) {
    return { ok: false, error: 'Local storage is not available.' }
  }

  const snapshot = createEditableConfigSnapshot(input)
  storage.setItem(APP_CONFIG_STORAGE_KEY, JSON.stringify(snapshot))
  applyEditableConfigSnapshot(snapshot)
  return { ok: true, config: editableConfig.value }
}

function clearEditableAppConfig() {
  const storage = getLocalStorageSafe()
  if (storage) {
    storage.removeItem(APP_CONFIG_STORAGE_KEY)
  }
  applyEditableConfigSnapshot(defaultEditableConfig)
}

function importEditableAppConfigFromJsonText(jsonText) {
  let parsed = null
  try {
    parsed = JSON.parse(String(jsonText || ''))
  } catch {
    return { ok: false, error: 'Invalid JSON.' }
  }

  if (!isPlainObject(parsed)) {
    return { ok: false, error: 'App config JSON must be an object.' }
  }

  return saveEditableAppConfig(parsed)
}

function exportEditableAppConfigAsJson() {
  const snapshot = createEditableConfigSnapshot(editableConfig.value)
  return JSON.stringify(snapshot, null, 2)
}

function buildEditableAppConfigDraft() {
  return {
    ...editableConfig.value,
  }
}

loadEditableAppConfigFromStorage()

const languageMode = computed(() => editableConfig.value.languageMode)
const githubRepoUrl = computed(() => editableConfig.value.githubRepo)
const defaultConnectionProfile = computed(() => editableConfig.value.defaultConnectionProfile)
const connectionMode = computed(() => editableConfig.value.connectionMode)
const primaryColor = computed(() => editableConfig.value.primaryColor)
const dataInspectionMode = computed(() => Boolean(editableConfig.value.dataInspectionMode))

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function normalizeWordingDictionary(source) {
  if (!isPlainObject(source)) {
    return {}
  }

  const normalized = {}
  Object.entries(source).forEach(([key, value]) => {
    const normalizedKey = String(key || '').trim()
    if (!normalizedKey) return
    if (!isPlainObject(value)) return
    normalized[normalizedKey] = { ...value }
  })
  return normalized
}

const localWording = normalizeWordingDictionary(appConfig.wording)

const mergedWording = computed(() => {
  const backend = normalizeWordingDictionary(onlineWording.value)
  const merged = { ...localWording }

  Object.entries(backend).forEach(([key, backendEntry]) => {
    if (localWordingOverrideKeys.has(key)) {
      return
    }
    const localEntry = isPlainObject(localWording[key]) ? localWording[key] : {}
    merged[key] = {
      ...localEntry,
      ...backendEntry,
    }
  })

  return merged
})

function setLanguage(nextLanguage) {
  language.value = normalizeLanguage(nextLanguage)
}

function setOnlineWording(nextWording) {
  onlineWording.value = normalizeWordingDictionary(nextWording)
}

function clearOnlineWording() {
  onlineWording.value = {}
}

function getWordingValue(key, fallback = '') {
  const keyEntry = mergedWording.value?.[key]
  if (!keyEntry || typeof keyEntry !== 'object') return fallback

  return keyEntry[language.value] || keyEntry.de || keyEntry.en || fallback
}

const supportedLanguages = computed(() => {
  const supported = new Set()

  Object.values(mergedWording.value || {}).forEach((entry) => {
    if (!isPlainObject(entry)) return
    Object.keys(entry).forEach((langKey) => {
      const normalizedLangKey = String(langKey || '').trim()
      if (normalizedLangKey) supported.add(normalizedLangKey)
    })
  })

  if (!supported.size) {
    supported.add(language.value)
  }

  return Array.from(supported)
})

function t(key, fallback = '') {
  return getWordingValue(key, fallback)
}

export function useAppConfigStore() {
  return {
    primaryColor,
    dataInspectionMode,
    languageMode,
    showLanguageSwitch: computed(() => languageMode.value === 'multi'),
    githubRepoUrl,
    defaultConnectionProfile,
    connectionMode,
    editableAppConfig: editableConfig,
    hasSavedEditableAppConfig: computed(() => Boolean(editableConfig.value.updatedAt)),
    language,
    supportedLanguages,
    setLanguage,
    loadEditableAppConfigFromStorage,
    saveEditableAppConfig,
    clearEditableAppConfig,
    importEditableAppConfigFromJsonText,
    exportEditableAppConfigAsJson,
    buildEditableAppConfigDraft,
    setOnlineWording,
    clearOnlineWording,
    t,
  }
}
