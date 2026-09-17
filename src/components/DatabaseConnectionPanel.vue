<script setup>
import { computed, ref, watch } from 'vue'
import { useAppConfigStore } from '../stores/useAppConfigStore'
import { useAuthStore } from '../stores/useAuthStore'
import { useConnectionProfileStore } from '../stores/useConnectionProfileStore'

const props = defineProps({
  canEditViewerSettings: { type: Boolean, default: false },
  // (settings | null) => Promise<{ ok, error? }>; null removes the data source overrides.
  applyViewerSettings: { type: Function, default: null },
})

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
const isSaving = ref(false)
const isCheckingDataModel = ref(false)
const isApplyingViewerSettings = ref(false)
const viewerSettingsForm = ref({})
const basicConfigForm = ref({})

const {
  t,
  basicConfig,
  basicConfigSource,
  applyBasicConfig,
  dataSourceViewerSettings,
  effectiveViewerSettings,
  exportBasicConfigAsJson,
} = useAppConfigStore()

// The basic config is a file next to the build, which a browser cannot write. The form applies
// the values until the next reload; the download produces the file for /public/app-config/.
function hydrateBasicConfigForm() {
  basicConfigForm.value = {
    connectionMode: basicConfig.value.connectionMode,
    language: basicConfig.value.language,
    languageMode: basicConfig.value.languageMode,
    primaryColor: basicConfig.value.primaryColor,
    dataInspectionMode: basicConfig.value.dataInspectionMode,
    includeConnectionProfile: Boolean(basicConfig.value.connectionProfile),
  }
}

hydrateBasicConfigForm()

const hasViewerSettingsOverrides = computed(() => Object.keys(dataSourceViewerSettings.value).length > 0)

function hydrateViewerSettingsForm() {
  viewerSettingsForm.value = { ...effectiveViewerSettings.value }
}

hydrateViewerSettingsForm()
watch(effectiveViewerSettings, hydrateViewerSettingsForm)
const { token } = useAuthStore()
const {
  connectionProfile,
  hasConnectionProfile,
  isProfileFixed,
  saveConnectionProfile,
  clearConnectionProfile,
  importConnectionProfileFromJsonText,
  exportConnectionProfileAsJson,
  buildDraftProfile,
  testConnection,
  checkDataModelImplementation,
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

// Saving runs the connection test first; a profile that fails it is not stored.
async function onSave() {
  fieldErrors.value = {}
  isSaving.value = true
  const result = await saveConnectionProfile(form.value)
  isSaving.value = false
  if (!result.ok) {
    fieldErrors.value = result.errors || {}
    const reason =
      result.reason === 'connection-test-failed'
        ? ` ${t('dbConnectionSaveTestFailed', 'The connection test failed:')} ${result.error || ''}`
        : ''
    setStatus('error', `${t('dbConnectionSaveFailed', 'Connection profile could not be saved.')}${reason}`)
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
  isSaving.value = true
  const result = await importConnectionProfileFromJsonText(text)
  isSaving.value = false
  if (!result.ok) {
    fieldErrors.value = result.errors || {}
    setStatus('error', result.error || t('dbConnectionImportFailed', 'Connection profile import failed.'))
    return
  }

  hydrateFormFromStore()
  fieldErrors.value = {}
  setStatus('success', t('dbConnectionImportSuccess', 'Connection profile imported.'))
}

async function runApplyViewerSettings(nextSettings) {
  if (!props.applyViewerSettings || !props.canEditViewerSettings) return
  isApplyingViewerSettings.value = true
  const result = await props.applyViewerSettings(nextSettings)
  isApplyingViewerSettings.value = false
  if (!result?.ok) {
    setStatus('error', result?.error || t('viewerSettingsApplyFailed', 'Viewer settings could not be applied.'))
    return
  }
  hydrateViewerSettingsForm()
  setStatus('success', t('viewerSettingsApplySuccess', 'Viewer settings applied to the data source.'))
}

function onApplyViewerSettings() {
  return runApplyViewerSettings({ ...viewerSettingsForm.value })
}

function onUseBasicViewerSettings() {
  return runApplyViewerSettings(null)
}

function buildBasicConfigDraft() {
  const { includeConnectionProfile, ...values } = basicConfigForm.value
  const profile = includeConnectionProfile ? connectionProfile.value : null
  return {
    ...values,
    connectionProfile: profile
      ? { label: profile.label || '', baseUrl: profile.baseUrl, configPath: profile.configPath }
      : null,
  }
}

function onApplyBasicConfig() {
  // The connection profile is not switched at runtime: it decides the data source and is read on start.
  applyBasicConfig({ ...buildBasicConfigDraft(), connectionProfile: basicConfig.value.connectionProfile })
  hydrateBasicConfigForm()
  setStatus(
    'success',
    t('basicConfigApplySuccess', 'Basic config applied until the next reload. Download the file to keep it.'),
  )
}

function onDownloadBasicConfig() {
  const jsonText = exportBasicConfigAsJson(buildBasicConfigDraft())
  const blob = new Blob([jsonText], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'viewer-editor-app-config.v1.json'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
  setStatus('success', t('appSettingsDownloadSuccess', 'Basic config downloaded.'))
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

function formatDataModelCheckStatus(result) {
  const details = result?.details
  if (!details) {
    return t('dbConnectionCheckModelFailed', 'Data model check failed.')
  }

  const fieldKeys = Array.isArray(details.wikidataFieldKeys) ? details.wikidataFieldKeys : []
  if (!fieldKeys.length) {
    return `${t('dbConnectionCheckModelSuccess', 'Data model check finished.')}`
  }

  const checkMessages = Array.isArray(details.checks)
    ? details.checks.map((entry) => entry?.message).filter(Boolean)
    : []
  const summary = checkMessages.length ? checkMessages.join(' | ') : ''
  const probePath = details.probePath ? ` probe=${details.probePath}` : ''
  return `${t('dbConnectionCheckModelSuccess', 'Data model check finished.')}${probePath}${
    summary ? ` ${summary}` : ''
  }`
}

async function onCheckDataModel() {
  isCheckingDataModel.value = true
  fieldErrors.value = {}

  const result = await checkDataModelImplementation(form.value, {
    token: token.value || '',
  })
  isCheckingDataModel.value = false

  if (!result.ok) {
    fieldErrors.value = result.errors || {}
    setStatus('error', result.error || t('dbConnectionCheckModelFailed', 'Data model check failed.'))
    return
  }

  const statusTypeByResult = result.status === 'warning' ? 'neutral' : 'success'
  setStatus(statusTypeByResult, formatDataModelCheckStatus(result))
}
</script>

<template>
  <section class="connection-panel">
    <header class="connection-header">
      <h2>{{ t('dbConnectionTitle', 'Database Connection') }}</h2>
      <p>{{ t('dbConnectionDescription', 'Configure Strapi backend connection without hardcoding app endpoints.') }}</p>
      <p v-if="isProfileFixed" class="saved-meta">
        {{ t('dbConnectionFixedNote', 'This connection is set by the basic config of this deployment and cannot be changed here.') }}
      </p>
    </header>

    <div class="connection-form-grid">
      <label class="field">
        <span>{{ t('dbConnectionLabelField', 'Profile label (optional)') }}</span>
        <input v-model="form.label" :readonly="isProfileFixed" type="text" maxlength="120" :placeholder="t('dbConnectionLabelPlaceholder', 'My Strapi Instance')" />
        <small v-if="fieldErrors.label" class="field-error">{{ fieldErrors.label }}</small>
      </label>

      <label class="field">
        <span>{{ t('dbConnectionBaseUrlField', 'Base URL (Strapi)') }}</span>
        <input v-model="form.baseUrl" :readonly="isProfileFixed" type="url" placeholder="https://cms.example.org/project" />
        <small v-if="fieldErrors.baseUrl" class="field-error">{{ fieldErrors.baseUrl }}</small>
      </label>

      <label class="field">
        <span>{{ t('dbConnectionConfigPathField', 'Config endpoint path') }}</span>
        <input v-model="form.configPath" :readonly="isProfileFixed" type="text" placeholder="/api/viewer-setting" />
        <small v-if="fieldErrors.configPath" class="field-error">{{ fieldErrors.configPath }}</small>
      </label>
    </div>

    <div class="connection-actions">
      <button v-if="!isProfileFixed" type="button" class="transfer-btn transfer-btn-mode" :disabled="isSaving" @click="onSave">
        {{ isSaving ? t('dbConnectionTesting', 'Testing...') : t('dbConnectionSave', 'Save profile') }}
      </button>
      <button type="button" class="transfer-btn transfer-btn-mode" :disabled="isTesting" @click="onTestConnection">
        {{ isTesting ? t('dbConnectionTesting', 'Testing...') : t('dbConnectionTest', 'Test connection') }}
      </button>
      <button type="button" class="transfer-btn transfer-btn-mode" :disabled="isCheckingDataModel" @click="onCheckDataModel">
        {{
          isCheckingDataModel
            ? t('dbConnectionCheckingModel', 'Checking model...')
            : t('dbConnectionCheckModel', 'Check data model implementation')
        }}
      </button>
      <button type="button" class="transfer-btn transfer-btn-mode" :disabled="!hasConnectionProfile" @click="onDownloadProfile">
        {{ t('dbConnectionDownload', 'Download profile JSON') }}
      </button>
      <button v-if="!isProfileFixed" type="button" class="transfer-btn transfer-btn-mode" :disabled="isSaving" @click="triggerUpload">
        {{ t('dbConnectionUpload', 'Import profile JSON') }}
      </button>
      <button v-if="!isProfileFixed" type="button" class="transfer-btn transfer-btn-reset" @click="onResetToSaved">
        {{ t('dbConnectionResetFormButton', 'Reset form') }}
      </button>
      <button v-if="!isProfileFixed" type="button" class="transfer-btn transfer-btn-reset" :disabled="!hasConnectionProfile" @click="onClearSaved">
        {{ t('dbConnectionClearSaved', 'Clear saved profile') }}
      </button>
      <input ref="fileInput" type="file" accept=".json,application/json" @change="onUploadFileChange" />
    </div>

    <p v-if="connectionProfile?.updatedAt" class="saved-meta">
      {{ t('dbConnectionLastSaved', 'Last saved') }}: {{ connectionProfile.updatedAt }}
    </p>

    <header class="connection-header">
      <h2>{{ t('viewerSettingsTitle', 'Viewer settings') }}</h2>
      <p>
        {{
          t(
            'viewerSettingsDescription',
            'Stored with the data source: in the JSON file offline, in the Strapi settings online. Values the data source does not set come from the basic config.',
          )
        }}
      </p>
    </header>

    <p v-if="!props.canEditViewerSettings" class="saved-meta">
      {{ t('viewerSettingsNoDataSource', 'Open a data source (load a file or log in online) to change the viewer settings.') }}
    </p>

    <fieldset class="connection-form-grid viewer-settings-form" :disabled="!props.canEditViewerSettings || isApplyingViewerSettings">
      <label class="field">
        <span>{{ t('appSettingsLanguageField', 'Default language') }}</span>
        <select v-model="viewerSettingsForm.language">
          <option value="de">DE</option>
          <option value="en">EN</option>
        </select>
      </label>

      <label class="field">
        <span>{{ t('appSettingsLanguageModeField', 'Language mode') }}</span>
        <select v-model="viewerSettingsForm.languageMode">
          <option value="single">single</option>
          <option value="multi">multi</option>
        </select>
      </label>

      <label class="field">
        <span>{{ t('appSettingsPrimaryColorField', 'Primary color') }}</span>
        <div class="color-row">
          <input v-model="viewerSettingsForm.primaryColor" type="text" placeholder="#0066CC" />
          <input v-model="viewerSettingsForm.primaryColor" type="color" />
        </div>
      </label>

      <label class="field field-checkbox">
        <span>{{ t('appSettingsDataInspectionModeField', 'Data inspection mode') }}</span>
        <input v-model="viewerSettingsForm.dataInspectionMode" type="checkbox" />
      </label>
    </fieldset>

    <div class="connection-actions">
      <button
        type="button"
        class="transfer-btn transfer-btn-mode"
        :disabled="!props.canEditViewerSettings || isApplyingViewerSettings"
        @click="onApplyViewerSettings"
      >
        {{ t('viewerSettingsApply', 'Apply to data source') }}
      </button>
      <button
        type="button"
        class="transfer-btn transfer-btn-reset"
        :disabled="!props.canEditViewerSettings || isApplyingViewerSettings"
        @click="hydrateViewerSettingsForm"
      >
        {{ t('dbConnectionResetFormButton', 'Reset form') }}
      </button>
      <button
        type="button"
        class="transfer-btn transfer-btn-reset"
        :disabled="!props.canEditViewerSettings || !hasViewerSettingsOverrides || isApplyingViewerSettings"
        @click="onUseBasicViewerSettings"
      >
        {{ t('viewerSettingsUseBasic', 'Use basic config values') }}
      </button>
    </div>

    <p class="saved-meta">
      {{
        hasViewerSettingsOverrides
          ? t('viewerSettingsSourceDataSource', 'Source: the data source sets some of these values.')
          : t('viewerSettingsSourceBasic', 'Source: basic config (the data source sets none of these values).')
      }}
    </p>

    <header class="connection-header">
      <h2>{{ t('appSettingsTitle', 'Basic config') }}</h2>
      <p>
        {{
          t(
            'appSettingsDescription',
            'Basic config of this deployment from /public/app-config. It applies wherever the data source sets no values of its own.',
          )
        }}
      </p>
    </header>

    <div class="connection-form-grid">
      <label class="field">
        <span>{{ t('appSettingsConnectionModeField', 'Connection mode') }}</span>
        <select v-model="basicConfigForm.connectionMode">
          <option value="switchable">switchable</option>
          <option value="offline">offline</option>
          <option value="online">online</option>
        </select>
      </label>

      <label class="field">
        <span>{{ t('appSettingsLanguageField', 'Default language') }}</span>
        <select v-model="basicConfigForm.language">
          <option value="de">DE</option>
          <option value="en">EN</option>
        </select>
      </label>

      <label class="field">
        <span>{{ t('appSettingsLanguageModeField', 'Language mode') }}</span>
        <select v-model="basicConfigForm.languageMode">
          <option value="single">single</option>
          <option value="multi">multi</option>
        </select>
      </label>

      <label class="field">
        <span>{{ t('appSettingsPrimaryColorField', 'Primary color') }}</span>
        <div class="color-row">
          <input v-model="basicConfigForm.primaryColor" type="text" placeholder="#0066CC" />
          <input v-model="basicConfigForm.primaryColor" type="color" />
        </div>
      </label>

      <label class="field field-checkbox">
        <span>{{ t('appSettingsDataInspectionModeField', 'Data inspection mode') }}</span>
        <input v-model="basicConfigForm.dataInspectionMode" type="checkbox" />
      </label>

      <label class="field field-checkbox">
        <span>
          {{ t('basicConfigIncludeProfileField', 'Put the connection profile into the file (fixed for this deployment)') }}
          <template v-if="connectionProfile"> ({{ connectionProfile.baseUrl }})</template>
        </span>
        <input v-model="basicConfigForm.includeConnectionProfile" :disabled="!connectionProfile" type="checkbox" />
      </label>
    </div>

    <div class="connection-actions">
      <button type="button" class="transfer-btn transfer-btn-mode" @click="onApplyBasicConfig">
        {{ t('basicConfigApply', 'Apply') }}
      </button>
      <button type="button" class="transfer-btn transfer-btn-reset" @click="hydrateBasicConfigForm">
        {{ t('dbConnectionResetFormButton', 'Reset form') }}
      </button>
      <button type="button" class="transfer-btn transfer-btn-mode" @click="onDownloadBasicConfig">
        {{ t('appSettingsDownload', 'Download basic config JSON') }}
      </button>
    </div>

    <p class="saved-meta">
      {{
        t(
          'basicConfigEditNote',
          'The browser cannot change the file on the server. "Apply" is active until the next reload; to keep the values, download the file and place it in /public/app-config/.',
        )
      }}
    </p>

    <p class="saved-meta">
      {{
        basicConfigSource === 'file'
          ? t('appSettingsSourceBasicFile', 'Source: basic config from /public/app-config.')
          : t('appSettingsSourceDefaults', 'Source: built-in defaults (no basic config file loaded).')
      }}
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

.field-checkbox {
  grid-template-columns: auto auto;
  align-items: center;
  gap: 0.65rem;
}

.field-checkbox > input {
  width: 1.1rem;
  height: 1.1rem;
}

.color-row {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 0.55rem;
  align-items: center;
}

.color-row input[type='color'] {
  width: 3rem;
  min-width: 3rem;
  padding: 0.1rem;
}

.viewer-settings-form {
  margin: 0;
  min-width: 0;
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

  .field-checkbox {
    grid-template-columns: 1fr;
    justify-items: start;
  }
}
</style>
