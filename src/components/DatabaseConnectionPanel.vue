<script setup>
import { ref } from 'vue'
import { useAppConfigStore } from '../stores/useAppConfigStore'
import { useConnectionProfileStore } from '../stores/useConnectionProfileStore'

const fileInput = ref(null)
const form = ref({
  label: '',
  baseUrl: '',
  configPath: '',
})
const fieldErrors = ref({})
const statusMessage = ref('')
const statusType = ref('neutral')
const isTesting = ref(false)

const { t } = useAppConfigStore()
const {
  connectionProfile,
  hasConnectionProfile,
  saveConnectionProfile,
  clearConnectionProfile,
  importConnectionProfileFromJsonText,
  exportConnectionProfileAsJson,
  buildDraftProfile,
  testConnection,
} = useConnectionProfileStore()

hydrateFormFromStore()

function hydrateFormFromStore() {
  const draft = buildDraftProfile()
  form.value = {
    label: draft.label || '',
    baseUrl: draft.baseUrl || '',
    configPath: draft.configPath || '',
  }
}

function setStatus(type, message) {
  statusType.value = type
  statusMessage.value = message
}

function triggerUpload() {
  fileInput.value?.click()
}

function onSave() {
  fieldErrors.value = {}
  const result = saveConnectionProfile(form.value)
  if (!result.ok) {
    fieldErrors.value = result.errors || {}
    setStatus('error', t('dbConnectionSaveFailed', 'Connection profile could not be saved.'))
    return
  }

  hydrateFormFromStore()
  setStatus('success', t('dbConnectionSaveSuccess', 'Connection profile saved.'))
}

function onResetToSaved() {
  hydrateFormFromStore()
  fieldErrors.value = {}
  setStatus('neutral', t('dbConnectionResetForm', 'Form reset to saved profile.'))
}

function onClearSaved() {
  clearConnectionProfile()
  hydrateFormFromStore()
  fieldErrors.value = {}
  setStatus('neutral', t('dbConnectionCleared', 'Saved connection profile removed.'))
}

function onDownloadProfile() {
  const jsonText = exportConnectionProfileAsJson()
  if (!jsonText) {
    setStatus('error', t('dbConnectionNoSavedProfile', 'No saved profile available.'))
    return
  }

  const blob = new Blob([jsonText], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'viewer-editor-connection-profile.v1.json'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
  setStatus('success', t('dbConnectionDownloadSuccess', 'Connection profile downloaded.'))
}

async function onUploadFileChange(event) {
  const file = event.target.files?.[0]
  event.target.value = ''
  if (!file) return

  const text = await file.text()
  const result = importConnectionProfileFromJsonText(text)
  if (!result.ok) {
    fieldErrors.value = result.errors || {}
    setStatus('error', result.error || t('dbConnectionImportFailed', 'Connection profile import failed.'))
    return
  }

  hydrateFormFromStore()
  fieldErrors.value = {}
  setStatus('success', t('dbConnectionImportSuccess', 'Connection profile imported.'))
}

async function onTestConnection() {
  isTesting.value = true
  fieldErrors.value = {}

  const result = await testConnection(form.value)
  isTesting.value = false

  if (!result.ok) {
    fieldErrors.value = result.errors || {}
    setStatus('error', result.error || t('dbConnectionTestFailed', 'Connection test failed.'))
    return
  }

  const successLabel = t('dbConnectionTestSuccess', 'Connection test successful.')
  const details = result.details
    ? ` config=${result.details.configStatus}, auth=${result.details.authStatus}`
    : ''
  setStatus('success', `${successLabel}${details}`)
}
</script>

<template>
  <section class="connection-panel">
    <header class="connection-header">
      <h2>{{ t('dbConnectionTitle', 'Database Connection') }}</h2>
      <p>{{ t('dbConnectionDescription', 'Configure Strapi backend connection without hardcoding app endpoints.') }}</p>
    </header>

    <div class="connection-form-grid">
      <label class="field">
        <span>{{ t('dbConnectionLabelField', 'Profile label (optional)') }}</span>
        <input v-model="form.label" type="text" maxlength="120" :placeholder="t('dbConnectionLabelPlaceholder', 'My Strapi Instance')" />
        <small v-if="fieldErrors.label" class="field-error">{{ fieldErrors.label }}</small>
      </label>

      <label class="field">
        <span>{{ t('dbConnectionBaseUrlField', 'Base URL (Strapi)') }}</span>
        <input v-model="form.baseUrl" type="url" placeholder="https://cms.example.org/project" />
        <small v-if="fieldErrors.baseUrl" class="field-error">{{ fieldErrors.baseUrl }}</small>
      </label>

      <label class="field">
        <span>{{ t('dbConnectionConfigPathField', 'Config endpoint path') }}</span>
        <input v-model="form.configPath" type="text" placeholder="/api/viewer-setting" />
        <small v-if="fieldErrors.configPath" class="field-error">{{ fieldErrors.configPath }}</small>
      </label>
    </div>

    <div class="connection-actions">
      <button type="button" class="transfer-btn transfer-btn-mode" @click="onSave">
        {{ t('dbConnectionSave', 'Save profile') }}
      </button>
      <button type="button" class="transfer-btn transfer-btn-mode" :disabled="isTesting" @click="onTestConnection">
        {{ isTesting ? t('dbConnectionTesting', 'Testing...') : t('dbConnectionTest', 'Test connection') }}
      </button>
      <button type="button" class="transfer-btn transfer-btn-mode" :disabled="!hasConnectionProfile" @click="onDownloadProfile">
        {{ t('dbConnectionDownload', 'Download profile JSON') }}
      </button>
      <button type="button" class="transfer-btn transfer-btn-mode" @click="triggerUpload">
        {{ t('dbConnectionUpload', 'Import profile JSON') }}
      </button>
      <button type="button" class="transfer-btn transfer-btn-reset" @click="onResetToSaved">
        {{ t('dbConnectionResetFormButton', 'Reset form') }}
      </button>
      <button type="button" class="transfer-btn transfer-btn-reset" :disabled="!hasConnectionProfile" @click="onClearSaved">
        {{ t('dbConnectionClearSaved', 'Clear saved profile') }}
      </button>
      <input ref="fileInput" type="file" accept=".json,application/json" @change="onUploadFileChange" />
    </div>

    <p v-if="connectionProfile?.updatedAt" class="saved-meta">
      {{ t('dbConnectionLastSaved', 'Last saved') }}: {{ connectionProfile.updatedAt }}
    </p>

    <p v-if="statusMessage" class="status" :class="`status-${statusType}`">
      {{ statusMessage }}
    </p>
  </section>
</template>

<style scoped lang="scss">
.connection-panel {
  display: grid;
  gap: 1rem;
  padding: 1rem;
}

.connection-header {
  display: grid;
  gap: 0.4rem;
}

.connection-header h2 {
  margin: 0;
  font-size: 1.2rem;
}

.connection-header p {
  margin: 0;
  color: var(--ve-color-text-soft);
}

.connection-form-grid {
  display: grid;
  gap: 0.85rem;
  padding: 1rem;
  background: var(--ve-color-surface-panel);
  border: 1px solid var(--ve-color-border-default);
  border-radius: 10px;
}

.field {
  display: grid;
  gap: 0.35rem;
}

.field > span {
  font-weight: 600;
  color: var(--ve-color-text-default);
}

.field-error {
  color: #b42318;
  font-size: 0.86rem;
}

.connection-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.55rem;
  align-items: center;
}

.saved-meta {
  margin: 0;
  color: var(--ve-color-text-soft);
  font-size: 0.9rem;
}

.status {
  margin: 0;
  padding: 0.55rem 0.75rem;
  border-radius: 8px;
  border: 1px solid transparent;
}

.status-neutral {
  background: #f8fafc;
  border-color: #dbe3ee;
  color: #334155;
}

.status-success {
  background: #ecfdf3;
  border-color: #abefc6;
  color: #065f46;
}

.status-error {
  background: #fef3f2;
  border-color: #fecdca;
  color: #991b1b;
}

@media (max-width: 768px) {
  .connection-actions {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
