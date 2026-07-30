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
import StartFromScratchModal from './components/StartFromScratchModal.vue'
import ItemFieldEditor from './components/ItemFieldEditor.vue'
import LightboxModal from './components/LightboxModal.vue'
import ListPanel from './components/ListPanel.vue'
import Identity from './components/footer/Identity.vue'
import InfoPanel from './components/InfoPanel.vue'
import ConfigurationPanel from './components/ConfigurationPanel.vue'
import ReplacementsPanel from './components/ReplacementsPanel.vue'
import ReplacementsUnit from './components/ReplacementsUnit.vue'
import DatabaseConnectionPanel from './components/DatabaseConnectionPanel.vue'
import OnlineAccessPanel from './components/OnlineAccessPanel.vue'
import maximizeIcon from './assets/icons/maximize-2.svg'
import minimizeIcon from './assets/icons/minimize-2.svg'
import { useConnectionProfileStore } from './stores/useConnectionProfileStore'
import { useOnlineModeStore } from './stores/useOnlineModeStore'
import { useAuthStore } from './stores/useAuthStore'
import { useOnlineSettingsStore } from './stores/useOnlineSettingsStore'
import { useOnlineItemsStore } from './stores/useOnlineItemsStore'
import { useOnlineUpdatesStore } from './stores/useOnlineUpdatesStore'

const tabs = ['edit', 'configuration', 'replacements', 'database-connection', 'info']
const activeTab = ref('edit')
const appShellRef = ref(null)
const appTabsRowRef = ref(null)
const editStickyTopRef = ref(null)
let stickyResizeObserver = null

const {
  appendEditedTimestamp,
  dataMode,
  modeErrorMessage,
  loadDataModeFromSession,
  setDataMode,
  setModeErrorMessage,
  createEditedFileName,
} = useDataTransferStore()

const { primaryColor, dataInspectionMode, language, setLanguage, t } = useAppConfigStore()
const { connectionProfile, loadConnectionProfileFromStorage } = useConnectionProfileStore()
const { appMode, loadAppModeFromStorage } = useOnlineModeStore()
const { token, isAuthenticated, restoreSession } = useAuthStore()
const {
  settings: onlineSettings,
  fetchOnlineSettings,
  persistOnlineSettings,
  clearOnlineSettings,
  markOnlineSettingsInvalid,
} = useOnlineSettingsStore()
const { fetchOnlineItems, clearOnlineItems, activeItemsPath } = useOnlineItemsStore()
const {
  pendingUpdateCount,
  hasPendingUpdates,
  saveStatus: onlineSaveStatus,
  lastSaveError: onlineSaveError,
  clearOnlineUpdates,
  clearSaveFeedback,
  trackOnlineDraftCreate,
  trackOnlineFieldChange,
  saveOnlineUpdates,
} = useOnlineUpdatesStore()

const {
  initializeUserConfig,
  clearUserConfigSession,
  applyUserConfigToRawItems,
  createUserConfigPayload,
  applyImportedConfigPayload,
  hasUnappliedUserConfigChanges,
  appliedUserConfigFields,
  appliedItemLabelField,
  appliedMarkAsEditedBasis,
} = useUserConfigStore()

const editedItemsFirst = ref(false)
const showEditedSortToggle = computed(() => Boolean(appliedMarkAsEditedBasis.value))

const {
  rawItems,
  importSnapshot,
  suspendedItemIndices,
  searchQuery,
  selectedRawItem,
  filteredViewItems,
  selectedViewItem,
  isDirty,
  importFileName,
  importedConfig,
  errorMessage,
  hasData,
  initializeFromJsonArray,
  importFromJsonText,
  importFromCsvText,
  selectItem,
  updateField,
  toggleSuspendEditingByUid,
  resetToImportedSnapshot,
  createExportPayload,
  createSuspendedItemsPayload,
  createCsvExportText,
  markAsSaved,
  appendOnlineDraftItem,
  syncSnapshotItemAtIndex,
  isEditableSimpleValue,
  looksLikeImageUrl,
} = useViewerData({
  itemLabelField: appliedItemLabelField,
  markAsEditedBasis: appliedMarkAsEditedBasis,
  markAsEditedItemsFirst: editedItemsFirst,
})

const isLightboxOpen = ref(false)
const lightboxImageSrc = ref('')
const lightboxImageLoadFailed = ref(false)
const sidebarImageLoadFailed = ref(false)
const failedListImages = ref(new Set())
const isExtendedEditMode = ref(false)
const isStartFromScratchModalOpen = ref(false)
const startFromScratchModalError = ref('')
const candidateAutosuggestPrefills = ref({})
let candidateAutosuggestPrefillToken = 0

const { createReplacementsPayload, hasReplacementsChanges, resetReplacements } = useReplacementsStore()

const resultCountLabel = computed(() => {
  if (!hasData.value) return '0 / 0'
  return `${filteredViewItems.value.length} / ${rawItems.value.length}`
})

const showSampleDataButton = computed(() => !hasData.value)
const showStartFromScratchButton = computed(() => dataMode.value === 'json' && !hasData.value)

const hasPendingChanges = computed(() => {
  if (dataMode.value === 'csv') {
    return isDirty.value
  }
  return isDirty.value || hasReplacementsChanges.value
})

const availableFieldKeys = computed(() => {
  const keys = new Set()
  rawItems.value.forEach((item) => {
    Object.keys(item || {}).forEach((key) => {
      if (key === 'scan' || key === 'suspendEditing') return
      if (key === '__onlineMeta') return
      keys.add(key)
    })
  })
  return Array.from(keys)
})

const hasScanField = computed(() =>
  rawItems.value.some((item) => Object.prototype.hasOwnProperty.call(item || {}, 'scan')),
)

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
  const selectedIndex = selectedViewItem.value?._index
  const changed = updateField(key, value, configuredType)
  if (!changed) return

  if (appMode.value !== 'online' || !isAuthenticated.value) return
  if (!Number.isInteger(selectedIndex)) return

  const currentItem = rawItems.value[selectedIndex]
  if (!currentItem) return

  const isOnlineDraft = currentItem.__onlineMeta?.isDraft === true
  const snapshotItem = isOnlineDraft ? {} : importSnapshot.value[selectedIndex]
  if (!isOnlineDraft && !snapshotItem) return

  trackOnlineFieldChange({
    item: currentItem,
    snapshotItem,
    key,
    nextValue: currentItem[key],
  })
}

const canCreateOnlineItem = computed(
  () => appMode.value === 'online' && isAuthenticated.value && Boolean(activeItemsPath.value),
)

function onCreateOnlineItem() {
  if (!canCreateOnlineItem.value) return

  const configuredFields = appliedUserConfigFields.value || {}
  const fieldConfigs = Object.keys(configuredFields).length
    ? configuredFields
    : Object.fromEntries(availableFieldKeys.value.map((key) => [key, { type: 'normal' }]))

  const nextUid = appendOnlineDraftItem({
    fieldConfigs,
    itemsPath: activeItemsPath.value,
    includeScan: hasScanField.value,
  })

  const draftItem = rawItems.value[rawItems.value.length - 1]
  if (draftItem) {
    trackOnlineDraftCreate({ item: draftItem })
  }
  selectItem(nextUid)
}

async function onSaveOnlineChanges() {
  if (appMode.value !== 'online') return
  if (!isAuthenticated.value) return
  if (!connectionProfile.value) return
  if (!hasPendingUpdates.value) return

  const result = await saveOnlineUpdates({
    profile: connectionProfile.value,
    token: token.value || '',
  })

  if (result.ok) {
    markAsSaved(importFileName.value)
    return
  }

  if (Array.isArray(result.createdItems) && result.createdItems.length) {
    result.createdItems.forEach((createdItem) => {
      const createdIndex = rawItems.value.indexOf(createdItem)
      if (createdIndex !== -1) {
        syncSnapshotItemAtIndex(createdIndex)
      }
    })
  }
}

function onSuspendEditingToggle({ uid, checked }) {
  const shouldAutoSelectNext = Boolean(checked) && selectedViewItem.value?._uid === uid
  let nextUid = null

  if (shouldAutoSelectNext) {
    const currentIndex = filteredViewItems.value.findIndex((item) => item._uid === uid)
    if (currentIndex !== -1 && currentIndex < filteredViewItems.value.length - 1) {
      nextUid = filteredViewItems.value[currentIndex + 1]?._uid || null
    }
  }

  toggleSuspendEditingByUid(uid, checked)

  if (nextUid) {
    selectItem(nextUid)
  }
}

async function onApplyUserConfig() {
  applyUserConfigToRawItems(rawItems.value)
  if (dataMode.value === 'csv') {
    setDataMode('json')
  }
  isDirty.value = true

  if (appMode.value !== 'online' || !isAuthenticated.value || !connectionProfile.value) {
    return
  }

  const baseSettings =
    onlineSettings.value && typeof onlineSettings.value === 'object' ? onlineSettings.value : {}
  const userConfigPayload = createUserConfigPayload()
  const mergedSettings = {
    ...baseSettings,
    ...userConfigPayload,
    fields: userConfigPayload.fields,
  }

  await persistOnlineSettings(mergedSettings)
}

function onAcceptCandidate({ targetField, candidateValue, targetConfiguredType }) {
  const normalizedTargetField = String(targetField || '').trim()
  if (!normalizedTargetField) return

  const normalizedCandidateValue =
    typeof candidateValue === 'string' ? candidateValue : String(candidateValue ?? '')

  if (targetConfiguredType === 'wikidata-autosuggest') {
    candidateAutosuggestPrefillToken += 1
    candidateAutosuggestPrefills.value = {
      ...candidateAutosuggestPrefills.value,
      [normalizedTargetField]: {
        value: normalizedCandidateValue.trim(),
        token: candidateAutosuggestPrefillToken,
      },
    }
    return
  }

  onFieldChange(normalizedTargetField, normalizedCandidateValue, targetConfiguredType)
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

function openDatabaseConnectionTab() {
  setActiveTab('database-connection')
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

const {
  onDataFileSelected,
  onDownload,
  onStartFromScratch,
  onReset: onDataReset,
  onLoadSampleData,
} = useDataImportExport({
  dataMode,
  t,
  setModeErrorMessage,
  importFromCsvText,
  importFromJsonText,
  clearUserConfigSession,
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
  createSuspendedItemsPayload,
  createUserConfigPayload,
  createReplacementsPayload,
  isDirty,
  hasPendingChanges,
  hasUnappliedUserConfigChanges,
  resetToImportedSnapshot,
  resetReplacements,
})

function onReset() {
  const hasReset = onDataReset()
  if (hasReset) {
    clearOnlineUpdates()
  }
}

function onStartFromScratchOpen() {
  startFromScratchModalError.value = ''
  isStartFromScratchModalOpen.value = true
}

function onStartFromScratchClose() {
  startFromScratchModalError.value = ''
  isStartFromScratchModalOpen.value = false
}

async function onStartFromScratchSubmit(input) {
  const result = await onStartFromScratch(input)
  if (result?.ok) {
    onStartFromScratchClose()
    return
  }
  if (result?.error) {
    startFromScratchModalError.value = result.error
  }
}

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
  loadAppModeFromStorage()
  loadConnectionProfileFromStorage()
  restoreSession()
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
  [
    () => selectedViewItem.value?._uid || null,
    () => suspendedItemIndices.value.join('|'),
  ],
  ([nextSelectedUid]) => {
    candidateAutosuggestPrefills.value = {}
    if (!nextSelectedUid) return
    const nextSelectedIndex = selectedViewItem.value?._index
    if (!Number.isInteger(nextSelectedIndex)) return
    if (!suspendedItemIndices.value.includes(nextSelectedIndex)) return
    toggleSuspendEditingByUid(nextSelectedUid, false)
  },
)

watch(
  () => availableFieldKeys.value.join('|'),
  () => {
    if (appMode.value === 'online' && isAuthenticated.value) return
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

watch(
  [
    () => appMode.value,
    () => isAuthenticated.value,
    () => connectionProfile.value?.baseUrl || '',
    () => connectionProfile.value?.configPath || '',
  ],
  async ([nextMode, nextAuthenticated]) => {
    if (nextMode !== 'online' || !nextAuthenticated) {
      clearOnlineSettings()
      clearOnlineItems()
      clearOnlineUpdates()
      return
    }

    const result = await fetchOnlineSettings()
    if (!result.ok) return

    const itemsResult = await fetchOnlineItems({ settings: result.settings })
    if (!itemsResult.ok) return

    initializeFromJsonArray(itemsResult.items, `online:${itemsResult.itemsPath}`)
    clearOnlineUpdates()
    resetReplacements()

    const applyResult = applyImportedConfigPayload(result.settings)
    if (!applyResult.ok) {
      markOnlineSettingsInvalid(applyResult.error)
      return
    }

    applyUserConfigToRawItems(rawItems.value)
  },
)

watch(
  () => appliedMarkAsEditedBasis.value,
  (nextMarkAsEditedBasis) => {
    if (!nextMarkAsEditedBasis) {
      editedItemsFirst.value = false
    }
  },
)
</script>

<template>
  <div ref="appShellRef" class="app-shell">
    <header class="topbar content-grid-topbar content-grid-full">
      <h1>{{ t('appTitle', 'Viewer Editor') }}</h1>
      <div class="actions">
        <OnlineAccessPanel
          :has-pending-online-updates="hasPendingUpdates"
          :pending-online-update-count="pendingUpdateCount"
          :save-status="onlineSaveStatus"
          :save-error="onlineSaveError"
          @open-connection-tab="openDatabaseConnectionTab"
          @save-online-updates="onSaveOnlineChanges"
          @clear-save-feedback="clearSaveFeedback"
        />
        <DataTransferControls :has-data="hasData" :is-dirty="hasPendingChanges"
          :app-mode="appMode"
          :show-sample-data-button="showSampleDataButton" :show-start-from-scratch-button="showStartFromScratchButton"
          @file-selected="onDataFileSelected" @download="onDownload" @start-from-scratch="onStartFromScratchOpen"
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
          <button id="tab-database-connection" type="button" class="app-tab-btn" role="tab"
            aria-controls="panel-database-connection" :aria-selected="activeTab === 'database-connection'"
            :tabindex="activeTab === 'database-connection' ? 0 : -1"
            :class="{ active: activeTab === 'database-connection' }" @click="setActiveTab('database-connection')"
            @keydown="onTabKeydown($event, 'database-connection')">
            {{ t('tabDatabaseConnection', 'Database Connection') }}
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
          :suspended-item-indices="suspendedItemIndices"
          :item-caption-field-key="appliedItemLabelField" :mark-as-edited-basis-field="appliedMarkAsEditedBasis"
          :edited-item-icon-label="t('editedItemIconLabel', 'Als bearbeitet markiert')" :has-scan-field="hasScanField"
          :suspend-editing-label="t('suspendEditingLabel', 'Bearbeitung aussetzen')"
          :scan-preview-alt="t('scanPreviewAlt', 'Scan Vorschau')"
          :scan-unavailable-label="t('scanUnavailable', 'Scan nicht verfuegbar')"
          :list-empty-after-upload-label="t('listEmptyAfterUpload', 'Nach dem Upload erscheinen hier die Eintraege.')"
          :no-search-results-label="t('noSearchResults', 'Keine Treffer zur Suchanfrage.')"
          :show-edited-sort-toggle="showEditedSortToggle" :edited-items-first="editedItemsFirst"
          :edited-sort-toggle-label="t('editedSortToggleLabel', 'Bearbeitete zuerst')"
          :looks-like-image-url="looksLikeImageUrl" :has-list-image-failed="hasListImageFailed" :render-header="true"
          :render-body="false" :show-create-item-button="canCreateOnlineItem"
          :create-item-label="t('onlineCreateItem', 'New item')"
          :new-item-fallback-label="t('onlineNewItemFallback', 'New item')" @create-item="onCreateOnlineItem"
          @update:search-query="searchQuery = $event"
          @update:edited-items-first="editedItemsFirst = $event" @toggle-suspend-editing="onSuspendEditingToggle" />
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
            :suspended-item-indices="suspendedItemIndices"
            :item-caption-field-key="appliedItemLabelField" :mark-as-edited-basis-field="appliedMarkAsEditedBasis"
            :edited-item-icon-label="t('editedItemIconLabel', 'Als bearbeitet markiert')" :has-scan-field="hasScanField"
            :suspend-editing-label="t('suspendEditingLabel', 'Bearbeitung aussetzen')"
            :scan-preview-alt="t('scanPreviewAlt', 'Scan Vorschau')"
            :scan-unavailable-label="t('scanUnavailable', 'Scan nicht verfuegbar')"
            :list-empty-after-upload-label="t('listEmptyAfterUpload', 'Nach dem Upload erscheinen hier die Eintraege.')"
            :no-search-results-label="t('noSearchResults', 'Keine Treffer zur Suchanfrage.')"
            :new-item-fallback-label="t('onlineNewItemFallback', 'New item')"
            :looks-like-image-url="looksLikeImageUrl" :has-list-image-failed="hasListImageFailed" :render-header="false"
            :render-body="true" @clear-selection="clearSelection" @select-item="selectItem"
            @update:search-query="searchQuery = $event" @list-image-failed="listImageFailed"
            @toggle-suspend-editing="onSuspendEditingToggle" />

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
              <div class="sidebar-detail-grid" :class="{ 'sidebar-detail-grid-no-scan': !hasScanField }">
                <div v-if="hasScanField" class="scan-column">
                  <div class="scan-preview-wrap" v-if="looksLikeImageUrl(selectedRawItem.scan)">
                    <img v-if="!sidebarImageLoadFailed" :src="selectedRawItem.scan"
                      :alt="t('scanPreviewAlt', 'Scan Vorschau')" class="scan-preview"
                      @error="sidebarImageLoadFailed = true" @click="openLightbox(selectedRawItem.scan)" />
                    <div v-else class="scan-fallback">{{ t('scanUnavailable', 'Scan nicht verfuegbar') }}</div>
                  </div>
                  <div v-else class="scan-fallback">{{ t('scanUnavailable', 'Scan nicht verfuegbar') }}</div>
                  <ReplacementsUnit/>
                </div>

                <ItemFieldEditor :selected-raw-item="selectedRawItem" :selected-view-item="selectedViewItem"
                  :suspended-item-indices="suspendedItemIndices"
                  :show-raw-data-dev-preview="dataInspectionMode"
                  :raw-data-toggle-label="t('rawDataToggleLabel', 'show raw data')"
                  :raw-data-hide-label="t('rawDataHideLabel', 'hide raw data')"
                  :copy-raw-data-label="t('copyRawDataLabel', 'Copy raw data')"
                  :candidate-apply-to-label="t('candidateApplyToLabel', 'Uebernehmen in')"
                  :candidate-choose-target-label="t('candidateChooseTargetLabel', 'Bitte Ziel-Feld in Konfiguration waehlen')"
                  :candidate-autosuggest-prefills="candidateAutosuggestPrefills"
                  :suspend-editing-label="t('suspendEditingLabel', 'Bearbeitung aussetzen')"
                  :is-editable-simple-value="isEditableSimpleValue" @field-change="onFieldChange"
                  @toggle-suspend-editing="onSuspendEditingToggle" @accept-candidate="onAcceptCandidate" />
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

        <section v-if="activeTab === 'database-connection'" id="panel-database-connection"
          class="database-connection-tab-panel tab-sheet-panel" role="tabpanel" aria-labelledby="tab-database-connection">
          <DatabaseConnectionPanel />
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

    <StartFromScratchModal :is-open="isStartFromScratchModalOpen" :error-message="startFromScratchModalError"
      @close="onStartFromScratchClose" @submit="onStartFromScratchSubmit" />
  </div>
</template>
