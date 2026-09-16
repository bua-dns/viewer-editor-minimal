import { createApp } from 'vue'
import App from './App.vue'
import { useAppConfigStore } from './stores/useAppConfigStore'
import './assets/styles/index.scss'

// The basic config and the wording decide the connection mode, the colours and every
// label, so they are loaded before the first render. A failed load keeps the defaults.
// (A promise chain, not top-level await: the default Vite build target does not support it.)
useAppConfigStore()
  .loadBasicConfig()
  .then((result) => {
    if (!result.ok) {
      console.warn('Basic config load failed:', result)
    }
  })
  .catch((error) => {
    console.warn('Basic config load failed:', error)
  })
  .finally(() => {
    createApp(App).mount('#app')
  })
