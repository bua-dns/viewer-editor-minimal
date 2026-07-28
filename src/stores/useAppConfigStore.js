import { computed, ref } from 'vue'
import appConfig from '../../config/app.config'

const language = ref(appConfig.language || 'de')

function setLanguage(nextLanguage) {
  language.value = nextLanguage
}

function getWordingValue(key, fallback = '') {
  const keyEntry = appConfig.wording?.[key]
  if (!keyEntry || typeof keyEntry !== 'object') return fallback

  return keyEntry[language.value] || keyEntry.de || keyEntry.en || fallback
}

const supportedLanguages = computed(() => {
  const firstEntry = Object.values(appConfig.wording || {})[0]
  if (!firstEntry || typeof firstEntry !== 'object') return [language.value]
  return Object.keys(firstEntry)
})

function t(key, fallback = '') {
  return getWordingValue(key, fallback)
}

export function useAppConfigStore() {
  return {
    primaryColor: appConfig.primaryColor,
    dataInspectionMode: Boolean(appConfig.dataInspectionMode),
    language,
    supportedLanguages,
    setLanguage,
    t,
  }
}
