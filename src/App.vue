<script setup>
//src\App.vue
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useViewerData } from './composables/useViewerData'
import { useDataImportExport } from './composables/useDataImportExport'
import { useSelectionNavigation } from './composables/useSelectionNavigation'
import { useAppConfigStore } from './stores/useAppConfigStore'
import { useUserConfigStore } from './stores/useUserConfigStore'
import { useDataTransferStore } from './stores/useDataTransferStore'
import { useReplacementsStore } from './stores/useReplacementsStore'
import DataTransferControls from './components/DataTransferControls.vue'
import ItemFieldEditor from './components/ItemFieldEditor.vue'
import LightboxModal from './components/LightboxModal.vue'
import ListPanel from './components/ListPanel.vue'
import Identity from './components/footer/Identity.vue'
import InfoPanel from './components/InfoPanel.vue'
import ConfigurationPanel from './components/ConfigurationPanel.vue'
import ReplacementsPanel from './components/ReplacementsPanel.vue'
import ReplacementsUnit from './components/ReplacementsUnit.vue'
import maximizeIcon from './assets/icons/maximize-2.svg'
import minimizeIcon from './assets/icons/minimize-2.svg'

const tabs = ['edit', 'configuration', 'replacements', 'info']
const activeTab = ref('edit')
const appShellRef = ref(null)
const appTabsRowRef = ref(null)
const editStickyTopRef = ref(null)
let stickyResizeObserver = null

const {
  rawItems,
  searchQuery,
  selectedRawItem,
  filteredViewItems,
  selectedViewItem,
  isDirty,
  importFileName,
  importedConfig,
  errorMessage,
  hasData,
  importFromJsonText,
  importFromCsvText,
  selectItem,
  updateField,
  resetToImportedSnapshot,
  createExportPayload,
  createCsvExportText,
  markAsSaved,
  isEditableSimpleValue,
  looksLikeImageUrl,
} = useViewerData()

const isLightboxOpen = ref(false)
const lightboxImageSrc = ref('')
const lightboxImageLoadFailed = ref(false)
const sidebarImageLoadFailed = ref(false)
const failedListImages = ref(new Set())
const isExtendedEditMode = ref(false)
const {
  appendEditedTimestamp,
  dataMode,
  modeErrorMessage,
  loadDataModeFromSession,
  setDataMode,
  setModeErrorMessage,
  createEditedFileName,
} = useDataTransferStore()

const { primaryColor, language, setLanguage, t } = useAppConfigStore()

const {
  initializeUserConfig,
  clearUserConfigSession,
  applyUserConfigToRawItems,
  createUserConfigPayload,
  applyImportedConfigPayload,
  hasUnappliedUserConfigChanges,
} = useUserConfigStore()

const { createReplacementsPayload, hasReplacementsChanges, resetReplacements } = useReplacementsStore()

const resultCountLabel = computed(() => {
  if (!hasData.value) return '0 / 0'
  return `${filteredViewItems.value.length} / ${rawItems.value.length}`
})

const showSampleDataButton = computed(() => !hasData.value)

const hasPendingChanges = computed(() => isDirty.value || hasReplacementsChanges.value)

const availableFieldKeys = computed(() => {
  const keys = new Set()
  rawItems.value.forEach((item) => {
    Object.keys(item || {}).forEach((key) => {
      if (key !== 'scan') keys.add(key)
    })
  })
  return Array.from(keys)
})

function initializeUserConfigForCurrentData() {
  if (hasData.value) {
    initializeUserConfig(availableFieldKeys.value, true)
    return
  }
  initializeUserConfig([], false)
}

function onDataModeChanged() {
  clearUserConfigSession()
  initializeUserConfigForCurrentData()
}

function onFieldChange(key, value, configuredType) {
  updateField(key, value, configuredType)
}

function onApplyUserConfig() {
  applyUserConfigToRawItems(rawItems.value)
  if (dataMode.value === 'csv') {
    setDataMode('json')
  }
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

function setActiveTab(tab) {
  activeTab.value = tab
}

function onTabKeydown(event, tab) {
  const currentIndex = tabs.indexOf(tab)
  if (currentIndex === -1) return

  if (event.key === 'ArrowRight') {
    event.preventDefault()
    setActiveTab(tabs[(currentIndex + 1) % tabs.length])
    return
  }

  if (event.key === 'ArrowLeft') {
    event.preventDefault()
    setActiveTab(tabs[(currentIndex - 1 + tabs.length) % tabs.length])
    return
  }

  if (event.key === 'Home') {
    event.preventDefault()
    setActiveTab(tabs[0])
    return
  }

  if (event.key === 'End') {
    event.preventDefault()
    setActiveTab(tabs[tabs.length - 1])
    return
  }

  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    setActiveTab(tab)
  }
}

const {
  selectedFilteredIndex,
  canGoPrevious,
  canGoNext,
  selectPreviousItem,
  selectNextItem,
  clearSelection,
} = useSelectionNavigation({
  filteredViewItems,
  selectedViewItem,
  selectItem,
})

const { onDataFileSelected, onDownload, onReset, onLoadSampleData } = useDataImportExport({
  dataMode,
  t,
  setModeErrorMessage,
  importFromCsvText,
  importFromJsonText,
  initializeUserConfigForCurrentData,
  importedConfig,
  applyImportedConfigPayload,
  applyUserConfigToRawItems,
  rawItems,
  errorMessage,
  createEditedFileName,
  importFileName,
  createCsvExportText,
  appendEditedTimestamp,
  markAsSaved,
  createExportPayload,
  createUserConfigPayload,
  createReplacementsPayload,
  isDirty,
  hasPendingChanges,
  resetToImportedSnapshot,
  resetReplacements,
})

function closeLightbox() {
  isLightboxOpen.value = false
}

function toggleExtendedEditMode() {
  isExtendedEditMode.value = !isExtendedEditMode.value
}

function onSidebarClose() {
  clearSelection()
}

function beforeUnloadListener(event) {
  if (!hasPendingChanges.value && !hasUnappliedUserConfigChanges.value) return
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

function updateStickyMeasurements() {
  if (!appShellRef.value) return
  const tabsHeight = appTabsRowRef.value?.offsetHeight || 0
  const stickyTopHeight = editStickyTopRef.value?.offsetHeight || 0
  appShellRef.value.style.setProperty('--ve-tabs-row-height', `${tabsHeight}px`)
  appShellRef.value.style.setProperty('--ve-edit-sticky-stack-height', `${stickyTopHeight}px`)
}

onMounted(() => {
  document.documentElement.style.setProperty('--color-primary', primaryColor)
  loadDataModeFromSession()
  window.addEventListener('beforeunload', beforeUnloadListener)
  window.addEventListener('keydown', keydownListener)
  window.addEventListener('resize', updateStickyMeasurements)
  stickyResizeObserver = new ResizeObserver(() => {
    updateStickyMeasurements()
  })
  if (appTabsRowRef.value) stickyResizeObserver.observe(appTabsRowRef.value)
  if (editStickyTopRef.value) stickyResizeObserver.observe(editStickyTopRef.value)
  requestAnimationFrame(() => {
    updateStickyMeasurements()
  })
})

onBeforeUnmount(() => {
  window.removeEventListener('beforeunload', beforeUnloadListener)
  window.removeEventListener('keydown', keydownListener)
  window.removeEventListener('resize', updateStickyMeasurements)
  if (stickyResizeObserver) {
    stickyResizeObserver.disconnect()
    stickyResizeObserver = null
  }
})

watch(
  () => importFileName.value,
  () => {
    failedListImages.value = new Set()
    sidebarImageLoadFailed.value = false
    lightboxImageLoadFailed.value = false
    initializeUserConfigForCurrentData()
  },
)

watch(
  () => selectedRawItem.value?.scan,
  () => {
    sidebarImageLoadFailed.value = false
  },
)

watch(
  () => selectedRawItem.value,
  (nextSelectedRawItem) => {
    if (!nextSelectedRawItem) {
      isExtendedEditMode.value = false
    }
  },
)

watch(
  () => availableFieldKeys.value.join('|'),
  () => {
    initializeUserConfigForCurrentData()
  },
)

watch(
  () => activeTab.value,
  () => {
    requestAnimationFrame(() => {
      updateStickyMeasurements()
      if (stickyResizeObserver && appTabsRowRef.value) stickyResizeObserver.observe(appTabsRowRef.value)
      if (stickyResizeObserver && editStickyTopRef.value) stickyResizeObserver.observe(editStickyTopRef.value)
    })
  },
)
</script>

<template>
  <div ref="appShellRef" class="app-shell">
    <header class="topbar content-grid-topbar content-grid-full">
      <h1>{{ t('appTitle', 'Viewer Editor') }}</h1>
      <div class="actions">
        <DataTransferControls :has-data="hasData" :is-dirty="hasPendingChanges"
          :show-sample-data-button="showSampleDataButton" @file-selected="onDataFileSelected" @download="onDownload"
          @reset="onReset" @mode-changed="onDataModeChanged" @load-sample-data="onLoadSampleData" />
      </div>
    </header>
    <section class="app-tab-sheet" :class="{ 'edit-active': activeTab === 'edit' }">
      <div ref="appTabsRowRef" class="app-tabs-row">
        <nav class="app-tabs" role="tablist" :aria-label="t('appTabsAria', 'App sections')">
          <button id="tab-edit" type="button" class="app-tab-btn" role="tab" aria-controls="panel-edit"
            :aria-selected="activeTab === 'edit'" :tabindex="activeTab === 'edit' ? 0 : -1"
            :class="{ active: activeTab === 'edit' }" @click="setActiveTab('edit')"
            @keydown="onTabKeydown($event, 'edit')">
            {{ t('tabEdit', 'Edit') }}
          </button>
          <button id="tab-configuration" type="button" class="app-tab-btn" role="tab"
            aria-controls="panel-configuration" :aria-selected="activeTab === 'configuration'"
            :tabindex="activeTab === 'configuration' ? 0 : -1" :class="{ active: activeTab === 'configuration' }"
            @click="setActiveTab('configuration')" @keydown="onTabKeydown($event, 'configuration')">
            {{ t('tabConfig', 'Configuration') }}
          </button>
          <button id="tab-replacements" type="button" class="app-tab-btn" role="tab" aria-controls="panel-replacements"
            :aria-selected="activeTab === 'replacements'" :tabindex="activeTab === 'replacements' ? 0 : -1"
            :class="{ active: activeTab === 'replacements' }" @click="setActiveTab('replacements')"
            @keydown="onTabKeydown($event, 'replacements')">
            {{ t('tabReplacements', 'Replacements') }}
          </button>
          <button id="tab-info" type="button" class="app-tab-btn" role="tab" aria-controls="panel-info"
            :aria-selected="activeTab === 'info'" :tabindex="activeTab === 'info' ? 0 : -1"
            :class="{ active: activeTab === 'info' }" @click="setActiveTab('info')"
            @keydown="onTabKeydown($event, 'info')">
            {{ t('tabInfo', 'Info') }}
          </button>
        </nav>
        <div class="language-switch" :aria-label="t('languageSwitchAria', 'Sprache waehlen')">
          <button type="button" class="lang-btn" :class="{ active: language === 'de' }" @click="setLanguage('de')">
            {{ t('languageButtonDe', 'DE') }}
          </button>
          <button type="button" class="lang-btn" :class="{ active: language === 'en' }" @click="setLanguage('en')">
            {{ t('languageButtonEn', 'EN') }}
          </button>
        </div>
      </div>

      <section v-if="activeTab === 'edit'" ref="editStickyTopRef" class="edit-sticky-top">
        <ListPanel :item-label="t('itemsLabel', 'Items')" :import-file-name="importFileName"
          :result-count-label="resultCountLabel" :search-query="searchQuery" :search-label="t('searchLabel', 'Suche')"
          :search-placeholder="t('searchPlaceholder', 'Volltext ueber alle Felder')" :has-data="hasData"
          :filtered-view-items="filteredViewItems" :selected-view-item="selectedViewItem" :raw-items="rawItems"
          :scan-preview-alt="t('scanPreviewAlt', 'Scan Vorschau')"
          :scan-unavailable-label="t('scanUnavailable', 'Scan nicht verfuegbar')"
          :list-empty-after-upload-label="t('listEmptyAfterUpload', 'Nach dem Upload erscheinen hier die Eintraege.')"
          :no-search-results-label="t('noSearchResults', 'Keine Treffer zur Suchanfrage.')"
          :looks-like-image-url="looksLikeImageUrl" :has-list-image-failed="hasListImageFailed" :render-header="true"
          :render-body="false" @update:search-query="searchQuery = $event" />
      </section>

      <main class="tab-content">
        <section v-if="activeTab === 'edit'" id="panel-edit" class="content-grid tab-sheet-panel" role="tabpanel"
          aria-labelledby="tab-edit"
          :class="{ 'content-grid-selected': !!selectedRawItem, 'content-grid-extended': !!selectedRawItem && isExtendedEditMode }">
          <ListPanel v-if="!isExtendedEditMode" :item-label="t('itemsLabel', 'Items')"
            :import-file-name="importFileName" :result-count-label="resultCountLabel" :search-query="searchQuery"
            :search-label="t('searchLabel', 'Suche')"
            :search-placeholder="t('searchPlaceholder', 'Volltext ueber alle Felder')" :has-data="hasData"
            :filtered-view-items="filteredViewItems" :selected-view-item="selectedViewItem" :raw-items="rawItems"
            :scan-preview-alt="t('scanPreviewAlt', 'Scan Vorschau')"
            :scan-unavailable-label="t('scanUnavailable', 'Scan nicht verfuegbar')"
            :list-empty-after-upload-label="t('listEmptyAfterUpload', 'Nach dem Upload erscheinen hier die Eintraege.')"
            :no-search-results-label="t('noSearchResults', 'Keine Treffer zur Suchanfrage.')"
            :looks-like-image-url="looksLikeImageUrl" :has-list-image-failed="hasListImageFailed" :render-header="false"
            :render-body="true" @clear-selection="clearSelection" @select-item="selectItem"
            @update:search-query="searchQuery = $event" @list-image-failed="listImageFailed" />

          <aside v-if="selectedRawItem" class="sidebar-panel">
            <div class="sidebar-head">
              <div class="sidebar-nav" v-if="filteredViewItems.length > 1">
                <button type="button" :disabled="!canGoPrevious" @click="selectPreviousItem"
                  :aria-label="t('sidebarPreviousItemAria', 'Vorheriges Item')">
                  ←
                </button>
                <span class="scan-nav-index">{{ t('sidebarScanCounterPrefix', 'Scan') }} {{ selectedFilteredIndex + 1 }}
                  /
                  {{ filteredViewItems.length }}</span>
                <button type="button" :disabled="!canGoNext" @click="selectNextItem"
                  :aria-label="t('sidebarNextItemAria', 'Naechstes Item')">
                  →
                </button>
              </div>
              <button v-if="!isExtendedEditMode" type="button" class="sidebar-extend-toggle"
                @click="toggleExtendedEditMode"
                :aria-label="t('sidebarExtendAria', 'Editierbereich auf volle Breite erweitern')"
                :title="t('sidebarExtendLabel', 'Volle Breite')">
                <img :src="maximizeIcon" alt="" aria-hidden="true" class="sidebar-toggle-icon" />
              </button>
              <button v-else type="button" class="sidebar-extend-toggle" @click="toggleExtendedEditMode"
                :aria-label="t('sidebarCollapseAria', 'Editierbereich auf Standardbreite reduzieren')"
                :title="t('sidebarCollapseLabel', 'Standardbreite')">
                <img :src="minimizeIcon" alt="" aria-hidden="true" class="sidebar-toggle-icon" />
              </button>
              <button type="button" class="sidebar-close" @click="onSidebarClose"
                :aria-label="t('sidebarCloseAria', 'Sidebar schliessen')">
                ×
              </button>
            </div>
            <div class="sidebar-content">
              <div class="sidebar-detail-grid">
                <div class="scan-column">
                  <div class="scan-preview-wrap" v-if="looksLikeImageUrl(selectedRawItem.scan)">
                    <img v-if="!sidebarImageLoadFailed" :src="selectedRawItem.scan"
                      :alt="t('scanPreviewAlt', 'Scan Vorschau')" class="scan-preview"
                      @error="sidebarImageLoadFailed = true" @click="openLightbox(selectedRawItem.scan)" />
                    <div v-else class="scan-fallback">{{ t('scanUnavailable', 'Scan nicht verfuegbar') }}</div>
                  </div>
                  <div v-else class="scan-fallback">{{ t('scanUnavailable', 'Scan nicht verfuegbar') }}</div>
                  <ReplacementsUnit/>
                </div>

                <ItemFieldEditor :selected-raw-item="selectedRawItem" :is-editable-simple-value="isEditableSimpleValue"
                  @field-change="onFieldChange" />
              </div>
            </div>
          </aside>

          <section class="status-panel">
            <div>
              <p v-if="importFileName">{{ t('statusFilePrefix', 'Datei') }}: {{ importFileName }}</p>
              <p v-else>{{ t('noFileLoaded', 'Noch keine Datei geladen') }}</p>
            </div>
          </section>
        </section>

        <section v-if="activeTab === 'configuration'" id="panel-configuration"
          class="configuration-tab-panel tab-sheet-panel" role="tabpanel" aria-labelledby="tab-configuration">
          <ConfigurationPanel :has-data="hasData" @apply="onApplyUserConfig" />
        </section>

        <section v-if="activeTab === 'replacements'" id="panel-replacements"
          class="replacements-tab-panel tab-sheet-panel" role="tabpanel" aria-labelledby="tab-replacements">
          <ReplacementsPanel />
        </section>

        <section v-if="activeTab === 'info'" id="panel-info" class="info-tab-panel tab-sheet-panel" role="tabpanel"
          aria-labelledby="tab-info">
          <InfoPanel />
        </section>
      </main>

      <footer class="app-footer">
        <Identity />
      </footer>
    </section>

    <LightboxModal :is-open="isLightboxOpen" :image-src="lightboxImageSrc" :image-load-failed="lightboxImageLoadFailed"
      :close-label="t('close', 'Schliessen')" :image-alt="t('lightboxImageAlt', 'Scan gross')"
      :unavailable-label="t('scanUnavailable', 'Scan nicht verfuegbar')" @close="closeLightbox"
      @image-error="lightboxImageLoadFailed = true" />
  </div>
</template>
