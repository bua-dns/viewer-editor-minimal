<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useViewerData } from './composables/useViewerData'
import { useAppConfigStore } from './stores/useAppConfigStore'
import { useUserConfigStore } from './stores/useUserConfigStore'
import UserConfigPanel from './components/UserConfigPanel.vue'

const fileInput = ref(null)
const {
  rawItems,
  searchQuery,
  selectedRawItem,
  filteredViewItems,
  selectedViewItem,
  isDirty,
  importFileName,
  errorMessage,
  hasData,
  importFromJsonText,
  importFromCsvText,
  selectItem,
  updateField,
  resetToImportedSnapshot,
  createExportPayload,
  markAsSaved,
  isEditableSimpleValue,
  looksLikeImageUrl,
} = useViewerData()

const isLightboxOpen = ref(false)
const lightboxImageSrc = ref('')
const lightboxImageLoadFailed = ref(false)
const sidebarImageLoadFailed = ref(false)
const failedListImages = ref(new Set())
const appendEditedTimestamp = ref(true)
const dataMode = ref('json')
const modeErrorMessage = ref('')

const DATA_MODE_SESSION_KEY = 'viewerEditor.dataMode.v1'

const { title: appTitle, primaryColor, language, itemLabel, setLanguage, t } = useAppConfigStore()

const uploadButtonLabel = computed(() =>
  dataMode.value === 'csv' ? t('uploadCsv', 'CSV hochladen') : t('uploadJson', 'JSON hochladen'),
)

const downloadButtonLabel = computed(() =>
  dataMode.value === 'csv' ? t('downloadCsv', 'CSV herunterladen') : t('downloadJson', 'JSON herunterladen'),
)

const uploadAccept = computed(() => (dataMode.value === 'csv' ? '.csv,text/csv' : '.json,application/json'))

const {
  initializeUserConfig,
  clearUserConfigSession,
  applyUserConfigToRawItems,
  createUserConfigPayload,
  getAppliedFieldLabel,
  getAppliedFieldInputType,
  getAppliedFieldPlaceholder,
  getDisplayedFieldKeys,
  hasUnappliedUserConfigChanges,
} = useUserConfigStore()

const resultCountLabel = computed(() => {
  if (!hasData.value) return '0 / 0'
  return `${filteredViewItems.value.length} / ${rawItems.value.length}`
})

const selectedFilteredIndex = computed(() => {
  if (!selectedViewItem.value) return -1
  return filteredViewItems.value.findIndex((item) => item._uid === selectedViewItem.value._uid)
})

const canGoPrevious = computed(() => selectedFilteredIndex.value > 0)
const canGoNext = computed(
  () =>
    selectedFilteredIndex.value !== -1 &&
    selectedFilteredIndex.value < filteredViewItems.value.length - 1,
)

const availableFieldKeys = computed(() => {
  const keys = new Set()
  rawItems.value.forEach((item) => {
    Object.keys(item || {}).forEach((key) => {
      if (key !== 'scan') keys.add(key)
    })
  })
  return Array.from(keys)
})

const displayedFieldKeys = computed(() => {
  return getDisplayedFieldKeys(selectedRawItem.value)
})

function loadDataModeFromSession() {
  const stored = sessionStorage.getItem(DATA_MODE_SESSION_KEY)
  if (stored === 'json' || stored === 'csv') {
    dataMode.value = stored
  }
}

function setDataMode(nextMode) {
  if (nextMode !== 'json' && nextMode !== 'csv') return
  if (nextMode === dataMode.value) return

  dataMode.value = nextMode
  modeErrorMessage.value = ''
  sessionStorage.setItem(DATA_MODE_SESSION_KEY, nextMode)

  clearUserConfigSession()
  if (hasData.value) {
    initializeUserConfig(availableFieldKeys.value, hasData.value)
  } else {
    initializeUserConfig([], false)
  }
}

function detectUploadType(fileName) {
  const lower = fileName.toLowerCase()
  if (lower.endsWith('.json')) return 'json'
  if (lower.endsWith('.csv')) return 'csv'
  return 'unknown'
}

async function onFileChange(event) {
  const file = event.target.files?.[0]
  if (!file) return

  const detectedType = detectUploadType(file.name)
  if (detectedType !== dataMode.value) {
    modeErrorMessage.value = t('uploadModeMismatchError', 'Dateityp passt nicht zum gewaehlten Modus.')
    event.target.value = ''
    return
  }

  if (dataMode.value === 'csv') {
    const text = await file.text()
    modeErrorMessage.value = ''
    importFromCsvText(text, file.name)
    event.target.value = ''
    return
  }

  const text = await file.text()
  modeErrorMessage.value = ''
  importFromJsonText(text, file.name)
  event.target.value = ''
}

function triggerUpload() {
  fileInput.value?.click()
}

function onFieldInput(key, event) {
  updateField(key, event.target.value)
}

function onBooleanChange(key, event) {
  updateField(key, event.target.checked)
}

function clearSelection() {
  selectItem(null)
}

function onReset() {
  if (!isDirty.value) return
  const confirmed = globalThis.confirm(t('resetConfirm', 'Aenderungen verwerfen und auf Import zuruecksetzen?'))
  if (!confirmed) return
  resetToImportedSnapshot()
}

function onDownload() {
  const payload = createExportPayload()
  const json = JSON.stringify(payload, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  const importedBaseName = importFileName.value ? importFileName.value.replace(/\.json$/i, '') : 'data'
  const baseName = importedBaseName.replace(/-edited(?:-\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2})?$/i, '')
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19)
  link.href = url
  link.download = appendEditedTimestamp.value
    ? `${baseName}-edited-${timestamp}.json`
    : `${baseName}-edited.json`
  const downloadFileName = link.download
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)

  if (appendEditedTimestamp.value) {
    markAsSaved(downloadFileName)
  }
}

function onDownloadUserConfig() {
  const payload = createUserConfigPayload()
  const json = JSON.stringify(payload, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  const importedBaseName = importFileName.value ? importFileName.value.replace(/\.json$/i, '') : 'data'
  link.href = url
  link.download = `${importedBaseName}-user-config.json`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

function onApplyUserConfig() {
  applyUserConfigToRawItems(rawItems.value)
  isDirty.value = true
}

function openLightbox(url) {
  if (!url) return
  lightboxImageSrc.value = url
  lightboxImageLoadFailed.value = false
  isLightboxOpen.value = true
}

function listImageFailed(uid) {
  failedListImages.value.add(uid)
}

function hasListImageFailed(uid) {
  return failedListImages.value.has(uid)
}

function selectPreviousItem() {
  if (!canGoPrevious.value) return
  const previousItem = filteredViewItems.value[selectedFilteredIndex.value - 1]
  if (previousItem) selectItem(previousItem._uid)
}

function selectNextItem() {
  if (!canGoNext.value) return
  const nextItem = filteredViewItems.value[selectedFilteredIndex.value + 1]
  if (nextItem) selectItem(nextItem._uid)
}

function closeLightbox() {
  if (document.fullscreenElement) {
    document.exitFullscreen()
  }
  isLightboxOpen.value = false
}

async function toggleFullscreen() {
  if (document.fullscreenElement) {
    await document.exitFullscreen()
    return
  }
  const target = document.querySelector('.lightbox-content')
  if (target?.requestFullscreen) {
    await target.requestFullscreen()
  }
}

function beforeUnloadListener(event) {
  if (!isDirty.value && !hasUnappliedUserConfigChanges.value) return
  event.preventDefault()
  event.returnValue = ''
}

function keydownListener(event) {
  if (event.key === 'Escape' && isLightboxOpen.value) {
    closeLightbox()
    return
  }

  if (event.key === 'Escape' && selectedRawItem.value) {
    clearSelection()
  }
}

onMounted(() => {
  document.documentElement.style.setProperty('--color-primary', primaryColor)
  loadDataModeFromSession()
  window.addEventListener('beforeunload', beforeUnloadListener)
  window.addEventListener('keydown', keydownListener)
})

onBeforeUnmount(() => {
  window.removeEventListener('beforeunload', beforeUnloadListener)
  window.removeEventListener('keydown', keydownListener)
})

watch(
  () => importFileName.value,
  () => {
    failedListImages.value = new Set()
    sidebarImageLoadFailed.value = false
    lightboxImageLoadFailed.value = false
    initializeUserConfig(availableFieldKeys.value, hasData.value)
  },
)

watch(
  () => selectedRawItem.value?.scan,
  () => {
    sidebarImageLoadFailed.value = false
  },
)

watch(
  () => availableFieldKeys.value.join('|'),
  () => {
    initializeUserConfig(availableFieldKeys.value, hasData.value)
  },
)
</script>

<template>
  <div class="app-shell">
    <header class="topbar">
      <h1>{{ appTitle }}</h1>
      <div class="actions">
        <label class="download-option">
          <input v-model="appendEditedTimestamp" type="checkbox" />
          <span>{{ t('downloadWithTimestamp', 'Dateiname mit Timestamp') }}</span>
        </label>
        <div class="data-mode-switch" :aria-label="t('dataModeAria', 'Datenmodus waehlen')">
          <button
            type="button"
            class="mode-btn"
            :class="{ active: dataMode === 'json' }"
            @click="setDataMode('json')"
          >
            {{ t('dataModeJson', 'JSON') }}
          </button>
          <span class="mode-separator">|</span>
          <button
            type="button"
            class="mode-btn"
            :class="{ active: dataMode === 'csv' }"
            @click="setDataMode('csv')"
          >
            {{ t('dataModeCsv', 'CSV') }}
          </button>
        </div>
        <button type="button" @click="triggerUpload">{{ uploadButtonLabel }}</button>
        <button type="button" :disabled="!hasData || !isDirty" @click="onDownload">{{ downloadButtonLabel }}</button>
        <button type="button" :disabled="!isDirty" @click="onReset">{{ t('reset', 'Reset') }}</button>
        <div class="language-switch" :aria-label="t('languageSwitchAria', 'Sprache waehlen')">
          <button
            type="button"
            class="lang-btn"
            :class="{ active: language === 'de' }"
            @click="setLanguage('de')"
          >
            {{ t('languageButtonDe', 'DE') }}
          </button>
          <span class="lang-separator">|</span>
          <button
            type="button"
            class="lang-btn"
            :class="{ active: language === 'en' }"
            @click="setLanguage('en')"
          >
            {{ t('languageButtonEn', 'EN') }}
          </button>
        </div>
        <input ref="fileInput" type="file" :accept="uploadAccept" @change="onFileChange" />
      </div>
    </header>

    <main class="content-grid" :class="{ 'content-grid-selected': !!selectedRawItem }">
      <section class="toolbar-panel">
        <div>
          <p class="meta" v-if="!importFileName">{{ t('noFileLoaded', 'Noch keine Datei geladen') }}</p>
        </div>
        <label class="search-wrap" v-if="importFileName">
          <span>{{ t('searchLabel', 'Suche') }}</span>
          <input v-model="searchQuery" type="search" :placeholder="t('searchPlaceholder', 'Volltext ueber alle Felder')" />
        </label>
        <p v-if="isDirty" class="dirty">{{ t('unsavedChanges', 'Ungespeicherte Aenderungen') }}</p>
      </section>

      <UserConfigPanel :has-data="hasData" @apply="onApplyUserConfig" @download="onDownloadUserConfig" />

      <section class="list-panel" @click="clearSelection">
        <h2>{{ itemLabel }} <span v-if="importFileName">({{ resultCountLabel }})</span></h2>
        <p v-if="!hasData" class="meta">{{ t('listEmptyAfterUpload', 'Nach dem Upload erscheinen hier die Eintraege.') }}</p>
        <p v-else-if="filteredViewItems.length === 0" class="meta">{{ t('noSearchResults', 'Keine Treffer zur Suchanfrage.') }}</p>
        <ul v-else class="card-grid">
          <li v-for="item in filteredViewItems" :key="item._uid">
            <button
              type="button"
              class="item-card"
              :class="{ active: selectedViewItem && selectedViewItem._uid === item._uid }"
              @click.stop="selectItem(item._uid)"
            >
              <div class="card-media">
                <img
                  v-if="looksLikeImageUrl(rawItems[item._index]?.scan) && !hasListImageFailed(item._uid)"
                  :src="rawItems[item._index]?.scan"
                  :alt="t('scanPreviewAlt', 'Scan Vorschau')"
                  @error="listImageFailed(item._uid)"
                />
                <div v-else class="scan-fallback">{{ t('scanUnavailable', 'Scan nicht verfuegbar') }}</div>
              </div>
              <div class="card-caption">
                {{ rawItems[item._index]?.inventory_number || `#${item._index + 1}` }}
              </div>
            </button>
          </li>
        </ul>
      </section>

      <aside v-if="selectedRawItem" class="sidebar-panel">
        <div class="sidebar-head">
          <div class="sidebar-nav" v-if="filteredViewItems.length > 1">
            <button
              type="button"
              :disabled="!canGoPrevious"
              @click="selectPreviousItem"
              :aria-label="t('sidebarPreviousItemAria', 'Vorheriges Item')"
            >
              ←
            </button>
            <span class="scan-nav-index"
              >{{ t('sidebarScanCounterPrefix', 'Scan') }} {{ selectedFilteredIndex + 1 }} /
              {{ filteredViewItems.length }}</span
            >
            <button
              type="button"
              :disabled="!canGoNext"
              @click="selectNextItem"
              :aria-label="t('sidebarNextItemAria', 'Naechstes Item')"
            >
              →
            </button>
          </div>
          <button
            type="button"
            class="sidebar-close"
            @click="clearSelection"
            :aria-label="t('sidebarCloseAria', 'Sidebar schliessen')"
          >
            ×
          </button>
        </div>
        <div class="sidebar-content">
          <div class="sidebar-detail-grid">
            <div class="scan-column">
              <div class="scan-preview-wrap" v-if="looksLikeImageUrl(selectedRawItem.scan)">
                <img
                  v-if="!sidebarImageLoadFailed"
                  :src="selectedRawItem.scan"
                  :alt="t('scanPreviewAlt', 'Scan Vorschau')"
                  class="scan-preview"
                  @error="sidebarImageLoadFailed = true"
                  @click="openLightbox(selectedRawItem.scan)"
                />
                <div v-else class="scan-fallback">{{ t('scanUnavailable', 'Scan nicht verfuegbar') }}</div>
              </div>
              <div v-else class="scan-fallback">{{ t('scanUnavailable', 'Scan nicht verfuegbar') }}</div>
            </div>

            <div class="field-grid">
              <template v-for="key in displayedFieldKeys" :key="key">
                <div class="field-row">
                  <label :for="`field-${key}`">{{ getAppliedFieldLabel(key) }}</label>
                  <template v-if="isEditableSimpleValue(selectedRawItem[key])">
                    <textarea
                      v-if="getAppliedFieldInputType(key, selectedRawItem[key]) === 'textarea'"
                      :id="`field-${key}`"
                      :placeholder="getAppliedFieldPlaceholder(key)"
                      :value="selectedRawItem[key] === null ? '' : selectedRawItem[key]"
                      @input="onFieldInput(key, $event)"
                    />
                    <input
                      v-else-if="getAppliedFieldInputType(key, selectedRawItem[key]) !== 'checkbox'"
                      :id="`field-${key}`"
                      :type="getAppliedFieldInputType(key, selectedRawItem[key])"
                      :placeholder="getAppliedFieldPlaceholder(key)"
                      :value="selectedRawItem[key] === null ? '' : selectedRawItem[key]"
                      @input="onFieldInput(key, $event)"
                    />
                    <input
                      v-else
                      :id="`field-${key}`"
                      type="checkbox"
                      :checked="Boolean(selectedRawItem[key])"
                      @change="onBooleanChange(key, $event)"
                    />
                  </template>
                  <pre v-else>{{ JSON.stringify(selectedRawItem[key]) }}</pre>
                </div>
              </template>
            </div>
          </div>
        </div>
      </aside>

      <section class="status-panel">
        <p v-if="importFileName">{{ t('statusFilePrefix', 'Datei') }}: {{ importFileName }}</p>
        <p v-if="errorMessage" class="error">{{ errorMessage }}</p>
        <p v-else-if="modeErrorMessage" class="error">{{ modeErrorMessage }}</p>
        <p v-else-if="!hasData">{{ t('uploadPrompt', 'Bitte eine JSON-Datei hochladen.') }}</p>
      </section>
    </main>

    <div v-if="isLightboxOpen" class="lightbox" @click.self="closeLightbox">
      <div class="lightbox-content">
        <div class="lightbox-actions">
          <button type="button" @click="toggleFullscreen">{{ t('fullscreen', 'Fullscreen') }}</button>
          <button type="button" @click="closeLightbox">{{ t('close', 'Schliessen') }}</button>
        </div>
        <img
          v-if="!lightboxImageLoadFailed"
          :src="lightboxImageSrc"
          :alt="t('lightboxImageAlt', 'Scan gross')"
          class="lightbox-image"
          @error="lightboxImageLoadFailed = true"
        />
        <div v-else class="scan-fallback scan-fallback-large">{{ t('scanUnavailable', 'Scan nicht verfuegbar') }}</div>
      </div>
    </div>
  </div>
</template>
