import { computed, ref } from 'vue'
import appConfig from '../../config/app.config'

const language = ref(appConfig.language || 'de')

function setLanguage(nextLanguage) {
  language.value = nextLanguage
}

function getWordingValue(handle, fallback = '') {
  const keyEntry = appConfig.wording?.[handle]
  if (!keyEntry || typeof keyEntry !== 'object') return fallback

  return keyEntry[language.value] || keyEntry.de || keyEntry.en || fallback
}

const supportedLanguages = computed(() => {
  const firstEntry = Object.values(appConfig.wording || {})[0]
  if (!firstEntry || typeof firstEntry !== 'object') return [language.value]
  return Object.keys(firstEntry)
})

const title = computed(() => getWordingValue(appConfig.wordingHandles?.title, 'Viewer Editor'))
const itemLabel = computed(() => getWordingValue(appConfig.wordingHandles?.itemLabel, 'Items'))

function t(handleKey, fallback = '') {
  return getWordingValue(appConfig.wordingHandles?.[handleKey], fallback)
}

export function useAppConfigStore() {
  return {
    title,
    primaryColor: appConfig.primaryColor,
    language,
    supportedLanguages,
    itemLabel,
    setLanguage,
    t,
  }
}
