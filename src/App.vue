<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useViewerData } from './composables/useViewerData'
import { useAppConfigStore } from './stores/useAppConfigStore'

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
const userConfigFields = ref({})
const appliedUserConfigFields = ref({})
const appliedUserConfigSnapshot = ref('')
const draggedFieldKey = ref('')
const isUserConfigOpen = ref(false)

const USER_CONFIG_SESSION_KEY = 'viewerEditor.userConfig.v1'

const { title: appTitle, primaryColor, language, itemLabel, setLanguage, t } = useAppConfigStore()

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

const sortedConfigFieldEntries = computed(() =>
  Object.entries(userConfigFields.value).sort((a, b) => (a[1].order || 0) - (b[1].order || 0)),
)

const displayedFieldKeys = computed(() => {
  if (!selectedRawItem.value) return []

  const keys = Object.keys(selectedRawItem.value).filter((key) => key !== 'scan')
  return keys.sort((a, b) => {
    const aOrder = appliedUserConfigFields.value[a]?.order ?? Number.MAX_SAFE_INTEGER
    const bOrder = appliedUserConfigFields.value[b]?.order ?? Number.MAX_SAFE_INTEGER
    if (aOrder !== bOrder) return aOrder - bOrder
    return a.localeCompare(b)
  })
})

const hasUserConfigChanges = computed(() =>
  Object.values(userConfigFields.value).some(
    (field) => field.type !== 'normal' || field.label || field.order !== 0 || field.placeholder,
  ),
)

const hasUnappliedUserConfigChanges = computed(
  () => serializeUserConfigFields(userConfigFields.value) !== appliedUserConfigSnapshot.value,
)

function serializeUserConfigFields(fields) {
  const normalized = {}
  Object.keys(fields)
    .sort()
    .forEach((key) => {
      normalized[key] = {
        type: fields[key]?.type || 'normal',
        label: fields[key]?.label || '',
        order: Number.isFinite(fields[key]?.order) ? fields[key].order : 0,
        placeholder: fields[key]?.placeholder || '',
      }
    })
  return JSON.stringify(normalized)
}

function buildDefaultUserConfigFields() {
  const fields = {}
  availableFieldKeys.value.forEach((key, index) => {
    fields[key] = {
      type: 'normal',
      label: '',
      order: index,
      placeholder: '',
    }
  })
  return fields
}

function loadUserConfigFromSession() {
  try {
    const raw = sessionStorage.getItem(USER_CONFIG_SESSION_KEY)
    if (!raw) return { fields: {}, appliedFields: {} }

    const parsed = JSON.parse(raw)
    return {
      fields: parsed?.fields && typeof parsed.fields === 'object' ? parsed.fields : {},
      appliedFields:
        parsed?.appliedFields && typeof parsed.appliedFields === 'object' ? parsed.appliedFields : {},
    }
  } catch {
    return { fields: {}, appliedFields: {} }
  }
}

function persistUserConfigToSession() {
  const payload = {
    fields: userConfigFields.value,
    appliedFields: appliedUserConfigFields.value,
  }
  sessionStorage.setItem(USER_CONFIG_SESSION_KEY, JSON.stringify(payload))
}

function initializeUserConfig() {
  const defaults = buildDefaultUserConfigFields()
  const persisted = loadUserConfigFromSession()

  const nextFields = {}
  const nextAppliedFields = {}

  Object.keys(defaults).forEach((key) => {
    nextFields[key] = {
      ...defaults[key],
      ...(persisted.fields[key] || {}),
    }
    nextAppliedFields[key] = {
      ...defaults[key],
      ...(persisted.appliedFields[key] || persisted.fields[key] || {}),
    }
  })

  userConfigFields.value = nextFields
  appliedUserConfigFields.value = nextAppliedFields
  appliedUserConfigSnapshot.value = serializeUserConfigFields(nextAppliedFields)
}

function normalizeConfigOrder() {
  const sortedKeys = Object.entries(userConfigFields.value)
    .sort((a, b) => (a[1].order || 0) - (b[1].order || 0))
    .map(([key]) => key)

  sortedKeys.forEach((key, index) => {
    userConfigFields.value[key].order = index
  })
}

function onDragStart(fieldKey) {
  draggedFieldKey.value = fieldKey
}

function onDropAt(targetFieldKey) {
  if (!draggedFieldKey.value || draggedFieldKey.value === targetFieldKey) return

  const orderedKeys = sortedConfigFieldEntries.value.map(([key]) => key)
  const fromIndex = orderedKeys.indexOf(draggedFieldKey.value)
  const toIndex = orderedKeys.indexOf(targetFieldKey)
  if (fromIndex === -1 || toIndex === -1) return

  const [movedKey] = orderedKeys.splice(fromIndex, 1)
  orderedKeys.splice(toIndex, 0, movedKey)

  orderedKeys.forEach((key, index) => {
    userConfigFields.value[key].order = index
  })

  draggedFieldKey.value = ''
}

function onDragEnd() {
  draggedFieldKey.value = ''
}

async function onFileChange(event) {
  const file = event.target.files?.[0]
  if (!file) return

  const text = await file.text()
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
  const payload = {
    version: 1,
    fields: userConfigFields.value,
  }
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
  normalizeConfigOrder()
  rawItems.value.forEach((item) => {
    Object.keys(userConfigFields.value).forEach((key) => {
      const configuredType = userConfigFields.value[key]?.type || 'normal'
      const currentValue = item[key]

      if (configuredType !== 'checkbox' && typeof currentValue === 'boolean') {
        item[key] = String(currentValue)
      }

      if (configuredType === 'checkbox' && typeof currentValue === 'string') {
        const normalized = currentValue.trim().toLowerCase()
        if (normalized === 'true') item[key] = true
        if (normalized === 'false') item[key] = false
      }
    })
  })

  appliedUserConfigFields.value = JSON.parse(JSON.stringify(userConfigFields.value))
  appliedUserConfigSnapshot.value = serializeUserConfigFields(appliedUserConfigFields.value)
  persistUserConfigToSession()
}

function getAppliedFieldLabel(key) {
  return appliedUserConfigFields.value[key]?.label?.trim() || key
}

function getAppliedFieldInputType(key, value) {
  const configuredType = appliedUserConfigFields.value[key]?.type || 'normal'
  if (configuredType === 'integer') return 'number'
  if (configuredType === 'checkbox') return 'checkbox'
  if (configuredType === 'text') return 'textarea'
  if (configuredType === 'normal') return 'text'

  if (typeof value === 'number') return 'number'
  if (typeof value === 'boolean') return 'checkbox'
  return 'text'
}

function getAppliedFieldPlaceholder(key) {
  return appliedUserConfigFields.value[key]?.placeholder || ''
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
    initializeUserConfig()
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
    if (!hasData.value) {
      userConfigFields.value = {}
      return
    }
    initializeUserConfig()
  },
)

watch(
  () => userConfigFields.value,
  () => {
    persistUserConfigToSession()
  },
  { deep: true },
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
        <button type="button" @click="triggerUpload">{{ t('uploadJson', 'JSON hochladen') }}</button>
        <button type="button" :disabled="!hasData || !isDirty" @click="onDownload">{{
          t('downloadJson', 'JSON herunterladen')
        }}</button>
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
        <input ref="fileInput" type="file" accept="application/json" @change="onFileChange" />
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

      <section class="user-config-panel" v-if="hasData">
        <div class="user-config-head" @click="isUserConfigOpen = !isUserConfigOpen">
          <div class="user-config-title">{{ t('configurationTitle', 'Konfiguration') }}</div>
          <div v-if="isUserConfigOpen" class="user-config-actions">
            <button type="button" :disabled="!hasUnappliedUserConfigChanges" @click.stop="onApplyUserConfig">
              {{ t('applyConfiguration', 'Konfiguration anwenden') }}
            </button>
            <button
              type="button"
              :disabled="!hasUnappliedUserConfigChanges"
              @click.stop="onDownloadUserConfig"
            >
              {{ t('downloadConfiguration', 'Konfiguration herunterladen') }}
            </button>
          </div>
          <span class="user-config-toggle-icon" aria-hidden="true">
            <span class="toggle-icon">{{ isUserConfigOpen ? '▴' : '▾' }}</span>
          </span>
        </div>
        <div v-if="isUserConfigOpen" class="user-config-grid">
          <div class="user-config-row user-config-row-head">
            <strong></strong>
            <strong>{{ t('configFieldHeader', 'Feld') }}</strong>
            <strong>{{ t('configTypeHeader', 'Typ') }}</strong>
            <strong>{{ t('configLabelHeader', 'Beschriftung') }}</strong>
            <strong>{{ t('configPlaceholderHeader', 'Eingabehinweis') }}</strong>
          </div>
          <div
            class="user-config-row"
            :class="{ 'is-dragging': draggedFieldKey === entry[0] }"
            v-for="entry in sortedConfigFieldEntries"
            :key="entry[0]"
            draggable="true"
            @dragstart="onDragStart(entry[0])"
            @dragover.prevent
            @drop="onDropAt(entry[0])"
            @dragend="onDragEnd"
          >
            <div class="drag-handle" aria-hidden="true">⋮⋮</div>
            <div class="field-key">{{ entry[0] }}</div>
            <select v-model="entry[1].type">
              <option value="normal">{{ t('configTypeNormal', 'normal (string)') }}</option>
              <option value="text">{{ t('configTypeText', 'Textfeld (text)') }}</option>
              <option value="integer">{{ t('configTypeInteger', 'Zahl (integer)') }}</option>
              <option value="checkbox">{{ t('configTypeCheckbox', 'Ja/Nein (checkbox)') }}</option>
            </select>
            <input v-model="entry[1].label" type="text" :placeholder="t('configLabelInputPlaceholder', 'Label')" />
            <input v-model="entry[1].placeholder" type="text" :placeholder="t('configHintInputPlaceholder', 'Hinweis')" />
          </div>
        </div>
      </section>

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
