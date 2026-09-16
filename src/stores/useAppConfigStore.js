import { computed, ref } from 'vue'
import { validateConnectionProfile } from '../composables/connectionProfile'
import { fetchFirstAvailableConfigText, resolvePublicConfigUrls } from '../composables/publicConfigUrls'

// Basic config: the one file a deployment ships next to the build. Without it the
// normalisers below supply the defaults. Config that belongs to a data set lives with
// the data source (JSON file offline, Strapi settings online), not here.
export const BASIC_CONFIG_FILE = 'viewer-editor-app-config.v1.json'
export const WORDING_FILE = 'wording.json'
const PUBLIC_CONFIG_FOLDER = 'app-config'

// Browser snapshot of the app settings from before the basic config existed. It is no
// longer read and gets removed on load.
const LEGACY_APP_CONFIG_STORAGE_KEY = 'viewerEditor.appConfig.v1'

const localWordingOverrideKeys = new Set(['tabDatabaseConnection', 'dbConnectionOpenTab'])

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function normalizeLanguageMode(value) {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
  return normalized === 'single' ? 'single' : 'multi'
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

function normalizeBasicConnectionProfile(value) {
  if (!isPlainObject(value)) return null
  const validation = validateConnectionProfile({ version: 1, ...value })
  return validation.ok ? validation.profile : null
}

export function normalizeBasicConfig(input = {}) {
  const source = isPlainObject(input) ? input : {}
  return {
    version: 1,
    connectionMode: normalizeConnectionMode(source.connectionMode),
    connectionProfile: normalizeBasicConnectionProfile(source.connectionProfile),
    language: normalizeLanguage(source.language),
    languageMode: normalizeLanguageMode(source.languageMode),
    primaryColor: normalizePrimaryColor(source.primaryColor),
    dataInspectionMode: Boolean(source.dataInspectionMode),
  }
}

function getLocalStorageSafe() {
  try {
    return globalThis.localStorage
  } catch {
    return null
  }
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

const basicConfig = ref(normalizeBasicConfig({}))
const basicConfigSource = ref('defaults')
const lastBasicConfigLoadError = ref(null)
const language = ref(basicConfig.value.language)
const localWording = ref({})
const onlineWording = ref({})

async function fetchPublicJson(fileName) {
  const urls = resolvePublicConfigUrls(fileName, PUBLIC_CONFIG_FOLDER)
  const fetched = await fetchFirstAvailableConfigText(urls)
  if (!fetched.ok) {
    return { ok: false, reason: fetched.reason, error: fetched.error, attemptedUrls: urls }
  }

  let parsed = null
  try {
    parsed = JSON.parse(fetched.text)
  } catch {
    return { ok: false, reason: 'invalid-json', error: 'Invalid JSON.', url: fetched.url }
  }

  if (!isPlainObject(parsed)) {
    return { ok: false, reason: 'invalid-config', error: 'JSON must be an object.', url: fetched.url }
  }

  return { ok: true, value: parsed, url: fetched.url }
}

function removeLegacyAppConfigSnapshot() {
  const storage = getLocalStorageSafe()
  if (!storage) return
  try {
    storage.removeItem(LEGACY_APP_CONFIG_STORAGE_KEY)
  } catch {
    // storage not writable: nothing to clean up
  }
}

function applyBasicConfig(input) {
  basicConfig.value = normalizeBasicConfig(input)
  language.value = dataSourceViewerSettings.value.language || basicConfig.value.language
}

// Loads the basic config and the local wording in parallel. Called once before the app
// mounts. A failed load keeps the hard-coded defaults, so the app always starts.
async function loadBasicConfig() {
  removeLegacyAppConfigSnapshot()

  const [configResult, wordingResult] = await Promise.all([
    fetchPublicJson(BASIC_CONFIG_FILE),
    fetchPublicJson(WORDING_FILE),
  ])

  if (configResult.ok) {
    if (isPlainObject(configResult.value.connectionProfile) && !normalizeBasicConnectionProfile(configResult.value.connectionProfile)) {
      console.warn('Basic config: connectionProfile is invalid and was ignored.')
    }
    applyBasicConfig(configResult.value)
    basicConfigSource.value = 'file'
    lastBasicConfigLoadError.value = null
  } else {
    applyBasicConfig({})
    basicConfigSource.value = 'defaults'
    lastBasicConfigLoadError.value = configResult
  }

  localWording.value = wordingResult.ok ? normalizeWordingDictionary(wordingResult.value) : {}

  return {
    ok: configResult.ok && wordingResult.ok,
    config: configResult,
    wording: wordingResult,
  }
}

// Template for a deployment: the bootstrap keys plus the viewer settings currently in effect.
function exportBasicConfigAsJson() {
  return JSON.stringify({ ...basicConfig.value, ...effectiveViewerSettings.value }, null, 2)
}

// Viewer settings can be overridden by the open data source (JSON `config` offline,
// `viewer-setting.settings` online), key by key. Only valid, present keys override.
export const VIEWER_SETTING_KEYS = ['language', 'languageMode', 'primaryColor', 'dataInspectionMode']

export function pickViewerSettings(source) {
  if (!isPlainObject(source)) return {}
  const picked = {}
  if (typeof source.language === 'string' && source.language.trim()) {
    picked.language = normalizeLanguage(source.language)
  }
  if (source.languageMode === 'single' || source.languageMode === 'multi') {
    picked.languageMode = source.languageMode
  }
  if (typeof source.primaryColor === 'string' && source.primaryColor.trim()) {
    picked.primaryColor = source.primaryColor.trim()
  }
  if (typeof source.dataInspectionMode === 'boolean') {
    picked.dataInspectionMode = source.dataInspectionMode
  }
  return picked
}

const dataSourceViewerSettings = ref({})

// Called whenever a data source opens (with its config) or closes (with nothing). The
// language is set only when the data source brings one, or reset when an override ends,
// so the DE | EN switch otherwise keeps the user's choice.
function setDataSourceViewerSettings(source) {
  const previous = dataSourceViewerSettings.value
  const next = pickViewerSettings(source)
  dataSourceViewerSettings.value = next
  if (next.language) {
    language.value = next.language
  } else if (previous.language) {
    language.value = basicConfig.value.language
  }
}

function clearDataSourceViewerSettings() {
  setDataSourceViewerSettings({})
}

const effectiveViewerSettings = computed(() => {
  const base = {}
  VIEWER_SETTING_KEYS.forEach((key) => {
    base[key] = basicConfig.value[key]
  })
  return { ...base, ...dataSourceViewerSettings.value }
})

const connectionMode = computed(() => basicConfig.value.connectionMode)
const basicConnectionProfile = computed(() => basicConfig.value.connectionProfile)
const languageMode = computed(() => effectiveViewerSettings.value.languageMode)
const primaryColor = computed(() => effectiveViewerSettings.value.primaryColor)
const dataInspectionMode = computed(() => effectiveViewerSettings.value.dataInspectionMode)

const mergedWording = computed(() => {
  const backend = normalizeWordingDictionary(onlineWording.value)
  const merged = { ...localWording.value }

  Object.entries(backend).forEach(([key, backendEntry]) => {
    if (localWordingOverrideKeys.has(key)) {
      return
    }
    const localEntry = isPlainObject(localWording.value[key]) ? localWording.value[key] : {}
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

function setLocalWording(nextWording) {
  localWording.value = normalizeWordingDictionary(nextWording)
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
    basicConfig,
    basicConfigSource,
    lastBasicConfigLoadError,
    loadBasicConfig,
    applyBasicConfig,
    exportBasicConfigAsJson,
    connectionMode,
    basicConnectionProfile,
    dataSourceViewerSettings,
    effectiveViewerSettings,
    setDataSourceViewerSettings,
    clearDataSourceViewerSettings,
    primaryColor,
    dataInspectionMode,
    languageMode,
    showLanguageSwitch: computed(() => languageMode.value === 'multi'),
    language,
    supportedLanguages,
    setLanguage,
    setLocalWording,
    setOnlineWording,
    clearOnlineWording,
    t,
  }
}
