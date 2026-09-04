
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
}

export default appConfig
