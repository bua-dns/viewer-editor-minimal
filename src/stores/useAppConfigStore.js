import { computed, ref } from 'vue'
import appConfig from '../../config/app.config'

const language = ref(appConfig.language || 'de')
const onlineWording = ref({})

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

const languageMode = normalizeLanguageMode(appConfig.languageMode)
const githubRepoUrl = normalizeGithubRepoUrl(appConfig.githubRepo)
const defaultConnectionProfile = normalizeDefaultConnectionProfile(appConfig.defaultConnectionProfile)

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
    const localEntry = isPlainObject(localWording[key]) ? localWording[key] : {}
    merged[key] = {
      ...localEntry,
      ...backendEntry,
    }
  })

  return merged
})

function setLanguage(nextLanguage) {
  language.value = nextLanguage
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
    primaryColor: appConfig.primaryColor,
    dataInspectionMode: Boolean(appConfig.dataInspectionMode),
    languageMode,
    showLanguageSwitch: languageMode === 'multi',
    githubRepoUrl,
    defaultConnectionProfile,
    language,
    supportedLanguages,
    setLanguage,
    setOnlineWording,
    clearOnlineWording,
    t,
  }
}
