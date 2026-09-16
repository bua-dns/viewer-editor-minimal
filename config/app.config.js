
//config\app.config.js
import wording from './wording.json'

const appConfig = {
  language: 'de',
  languageMode: 'single', // 'single' or 'multi'
  wording,
  githubRepo: 'https://github.com/bua-dns/viewer-editor-minimal', // optional; if empty, GitHub icon is hidden
  primaryColor: '#1f7a8c',
  connectionMode: 'online', // 'online', 'offline' or 'switchable',
  dataInspectionMode: false, // true or false
  defaultConnectionProfile: 'viewer-editor-connection-profile.v1.json', // from /public/connection-profile; if empty, use localStorage behavior
  // Build-only key, not editable in the Einstellungen tab: it decides where the app config
  // itself is fetched from, so it has to be known before that fetch happens.
  defaultAppConfig: 'viewer-editor-app-config.v1.json', // from /public/app-config; if empty, only app.config.js + localStorage are used
}

export default appConfig
