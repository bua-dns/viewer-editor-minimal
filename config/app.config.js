
//config\app.config.js
import wording from './wording.json'

const appConfig = {
  language: 'de',
  languageMode: 'single', // 'single' or 'multi'
  wording,
  githubRepo: '', // optional; if empty, GitHub icon is hidden
  primaryColor: '#1f7a8c',
  connectionMode: 'online', // 'online', 'offline' or 'switchable',
  dataInspectionMode: true, // true or false
}

export default appConfig
