<script setup>
//src\App.vue
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useViewerData } from './composables/useViewerData'
import { useDataImportExport } from './composables/useDataImportExport'
import { useReplacementsApply } from './composables/useReplacementsApply'
import { collectReplaceableFieldKeys } from './composables/replacementRules'
import { useSelectionNavigation } from './composables/useSelectionNavigation'
import { VIEWER_SETTING_KEYS, useAppConfigStore } from './stores/useAppConfigStore'
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
import { resolveItemsPathFromSettings } from './services/strapiApi'
import {
  buildHierarchyLevel1Options,
  buildHierarchyLevel2Options,
  isItemInHierarchyLevel1,
  normalizeHierarchyFieldList,
  normalizeHierarchyValue,
  resolveHierarchyFieldsFromSettings,
} from './composables/hierarchyConfig'

const tabs = ['edit', 'configuration', 'replacements', 'database-connection', 'info']
const activeTab = ref('edit')
const appShellRef = ref(null)
const topbarRef = ref(null)
const appTabsRowRef = ref(null)
const editStickyTopRef = ref(null)
const isTopbarCondensed = ref(false)
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

const {
  primaryColor,
  dataInspectionMode,
  showLanguageSwitch,
  language,
  setLanguage,
  t,
  setOnlineWording,
  clearOnlineWording,
  dataSourceViewerSettings,
  setDataSourceViewerSettings,
  clearDataSourceViewerSettings,
} = useAppConfigStore()
const { connectionProfile, initializeConnectionProfile } = useConnectionProfileStore()
const { appMode, onlineConfigOnly, loadAppModeFromStorage, loadOnlineConfigOnlyFromStorage } = useOnlineModeStore()
const { token, isAuthenticated, restoreSession } = useAuthStore()
const {
  settings: onlineSettings,
  fetchOnlineSettings,
  persistOnlineSettings,
  persistOnlineReplacements,
  clearOnlineSettings,
  markOnlineSettingsInvalid,
} = useOnlineSettingsStore()
const {
  fetchOnlineItems,
  fetchOnlineItemsForHierarchyLevel1,
  clearOnlineItems,
  activeItemsPath,
  hierarchyFields: onlineHierarchyFields,
  hierarchyLevel1Options: onlineHierarchyLevel1Options,
  selectedHierarchyLevel1Value,
} = useOnlineItemsStore()
const {
  pendingUpdateCount,
  hasPendingUpdates,
  saveStatus: onlineSaveStatus,
  lastSaveError: onlineSaveError,
  clearOnlineUpdates,
  clearSaveFeedback,
  trackOnlineDraftCreate,
  trackOnlineFieldChange,
  trackOnlineReplacementUpdatesForRemainingItems,
  saveOnlineUpdates,
} = useOnlineUpdatesStore()

const {
  initializeUserConfig,
  applyUserConfigToRawItems,
  createUserConfigPayload,
  applyImportedConfigPayload,
  hasUnappliedUserConfigChanges,
  appliedUserConfigFields,
  userConfigFields,
  appliedItemLabelField,
  appliedMarkAsEditedBasis,
  appliedHierarchyFields,
  appliedFirstLevelStaticList,
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
  applyReplacementsToLoadedItems,
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

const {
  createReplacementsPayload,
  hasReplacementsChanges,
  initializeReplacements,
  markReplacementsAsSaved,
  resetReplacements,
} = useReplacementsStore()

const replacementFieldConfigs = computed(() => {
  const applied = appliedUserConfigFields.value || {}
  if (collectReplaceableFieldKeys(applied).length) return applied
  return userConfigFields.value || {}
})

const { applyReplacementsNow } = useReplacementsApply({
  appMode,
  isAuthenticated,
  connectionProfile,
  token,
  onlineSettings,
  rawItems,
  importSnapshot,
  replacementFieldConfigs,
  applyReplacementsToLoadedItems,
  trackOnlineFieldChange,
  trackOnlineReplacementUpdatesForRemainingItems,
})

async function onApplyReplacements() {
  await applyReplacementsNow()
}

const resultCountLabel = computed(() => {
  if (!hasData.value) return '0 / 0'
  return `${filteredViewItems.value.length} / ${rawItems.value.length}`
})

const offlineSelectedHierarchyLevel1Value = ref('')
const hasSelectedHierarchyLevel1 = ref(false)
const expandedHierarchyLevel2Values = ref([])

// Online: the hierarchy comes from the Strapi settings and level-1 buckets are loaded on demand.
// Offline: it comes from the applied user config (imported file or Configuration tab) and all
// items are already in memory, so boxes and groups are counted from `rawItems`.
const hierarchicalFields = computed(() => {
  if (appMode.value === 'online' && isAuthenticated.value) {
    return resolveHierarchyFieldsFromSettings(onlineSettings.value)
  }
  return normalizeHierarchyFieldList(appliedHierarchyFields.value)
})
const hierarchyLevel1FieldKey = computed(() => hierarchicalFields.value[0] || '')
const hierarchyLevel2FieldKey = computed(() => hierarchicalFields.value[1] || '')
const hierarchyEnabled = computed(() => Boolean(hierarchyLevel1FieldKey.value && hierarchyLevel2FieldKey.value))

const hierarchyLevel1Options = computed(() => {
  if (!hierarchyEnabled.value) return []
  if (appMode.value === 'online' && isAuthenticated.value) {
    return onlineHierarchyLevel1Options.value
  }
  return buildHierarchyLevel1Options(
    rawItems.value,
    hierarchyLevel1FieldKey.value,
    appliedFirstLevelStaticList.value,
  )
})

const selectedHierarchyLevel1 = computed({
  get() {
    if (appMode.value === 'online' && isAuthenticated.value) {
      return selectedHierarchyLevel1Value.value
    }
    return offlineSelectedHierarchyLevel1Value.value
  },
  set(nextValue) {
    const normalized = normalizeHierarchyValue(nextValue)
    if (appMode.value === 'online' && isAuthenticated.value) {
      selectedHierarchyLevel1Value.value = normalized
      return
    }
    offlineSelectedHierarchyLevel1Value.value = normalized
  },
})

// Items reachable by prev/next and the suspend auto-advance: with an active level-1 selection only
// that category, as the list shows. Offline `rawItems` hold every category; online they already
// hold only the loaded bucket, so the filter changes nothing there.
const navigableViewItems = computed(() => {
  if (!hierarchyEnabled.value || !hasSelectedHierarchyLevel1.value) return filteredViewItems.value
  return filteredViewItems.value.filter((viewItem) =>
    isItemInHierarchyLevel1(
      rawItems.value[viewItem._index],
      hierarchyLevel1FieldKey.value,
      selectedHierarchyLevel1.value,
    ),
  )
})

function initializeExpandedHierarchyLevel2(nextSelectedLevel1 = selectedHierarchyLevel1.value) {
  if (!hierarchyEnabled.value) {
    expandedHierarchyLevel2Values.value = []
    return
  }

  if (!hasSelectedHierarchyLevel1.value) {
    expandedHierarchyLevel2Values.value = []
    return
  }

  const normalizedSelectedLevel1 = normalizeHierarchyValue(nextSelectedLevel1)
  if (!normalizedSelectedLevel1 && normalizedSelectedLevel1 !== '') {
    expandedHierarchyLevel2Values.value = []
    return
  }

  if (normalizedSelectedLevel1 === '' && selectedHierarchyLevel1.value === '' && !hasData.value) {
    expandedHierarchyLevel2Values.value = []
    return
  }

  const level2Options = buildHierarchyLevel2Options(
    rawItems.value,
    hierarchyLevel1FieldKey.value,
    hierarchyLevel2FieldKey.value,
    normalizedSelectedLevel1,
  )

  if (!level2Options.length) {
    expandedHierarchyLevel2Values.value = []
    return
  }

  expandedHierarchyLevel2Values.value = [level2Options[0].value]
}

const showSampleDataButton = computed(() => !hasData.value)
const showStartFromScratchButton = computed(() => dataMode.value === 'json' && !hasData.value)
const canConfigureWithoutData = computed(
  () => appMode.value === 'online' && isAuthenticated.value && Boolean(onlineSettings.value),
)

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

const isSidebarSuspendEditingChecked = computed(() => {
  const selectedIndex = selectedViewItem.value?._index
  if (!Number.isInteger(selectedIndex)) return false
  return suspendedItemIndices.value.includes(selectedIndex)
})

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

  const nextUid = appendOnlineDraftItem({
    fieldConfigs: appliedUserConfigFields.value || {},
    itemsPath: activeItemsPath.value,
    includeScan: hasScanField.value,
  })

  const draftItem = rawItems.value[rawItems.value.length - 1]
  if (draftItem) {
    trackOnlineDraftCreate({ item: draftItem })
  }
  selectItem(nextUid)
}

function onToggleHierarchyLevel2(value) {
  const normalized = normalizeHierarchyValue(value)
  const nextSet = new Set(expandedHierarchyLevel2Values.value.map((entry) => normalizeHierarchyValue(entry)))
  if (nextSet.has(normalized)) {
    nextSet.delete(normalized)
  } else {
    nextSet.add(normalized)
  }
  expandedHierarchyLevel2Values.value = Array.from(nextSet)
}

function onCollapseAllHierarchyLevel2() {
  expandedHierarchyLevel2Values.value = []
}

async function onSelectHierarchyLevel1(value) {
  if (!hierarchyEnabled.value) return

  const normalizedLevel1Value = normalizeHierarchyValue(value)
  clearSelection()

  if (appMode.value === 'online' && isAuthenticated.value) {
    if (!connectionProfile.value) return
    if (!onlineSettings.value || typeof onlineSettings.value !== 'object') return

    const result = await fetchOnlineItemsForHierarchyLevel1({
      settings: onlineSettings.value,
      level1Value: normalizedLevel1Value,
    })
    if (!result.ok) return

    initializeFromJsonArray(result.items, `online:${result.itemsPath}`)
    clearOnlineUpdates()

    const applyResult = applyImportedConfigPayload(onlineSettings.value)
    if (!applyResult.ok) {
      markOnlineSettingsInvalid(applyResult.error)
      return
    }

    applyUserConfigToRawItems(rawItems.value)
    hasSelectedHierarchyLevel1.value = true
    selectedHierarchyLevel1.value = normalizedLevel1Value
    initializeExpandedHierarchyLevel2(normalizedLevel1Value)
    return
  }

  hasSelectedHierarchyLevel1.value = true
  selectedHierarchyLevel1.value = normalizedLevel1Value
  initializeExpandedHierarchyLevel2(normalizedLevel1Value)
}

const hasPendingOnlineChanges = computed(() => {
  if (appMode.value !== 'online' || !isAuthenticated.value) return false
  return hasPendingUpdates.value || hasReplacementsChanges.value
})

async function persistReplacementRulesIfChanged() {
  if (!hasReplacementsChanges.value) return
  const result = await persistOnlineReplacements(createReplacementsPayload())
  if (result?.ok) {
    markReplacementsAsSaved()
  }
}

async function onSaveOnlineChanges() {
  if (appMode.value !== 'online') return
  if (!isAuthenticated.value) return
  if (!connectionProfile.value) return
  if (!hasPendingOnlineChanges.value) return

  if (!hasPendingUpdates.value) {
    await persistReplacementRulesIfChanged()
    return
  }

  const result = await saveOnlineUpdates({
    profile: connectionProfile.value,
    token: token.value || '',
  })

  await persistReplacementRulesIfChanged()

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
    const currentIndex = navigableViewItems.value.findIndex((item) => item._uid === uid)
    if (currentIndex !== -1 && currentIndex < navigableViewItems.value.length - 1) {
      nextUid = navigableViewItems.value[currentIndex + 1]?._uid || null
    }
  }

  toggleSuspendEditingByUid(uid, checked)

  if (nextUid) {
    selectItem(nextUid)
  }
}

function onSidebarSuspendEditingChange(event) {
  const uid = selectedViewItem.value?._uid
  if (!uid) return
  onSuspendEditingToggle({ uid, checked: event.target.checked })
}

// Keeps the keys the viewer does not edit (itemsPath, scanField, ...) and replaces the field
// config and the viewer settings; a viewer setting without override is removed.
function buildMergedOnlineSettings() {
  const baseSettings =
    onlineSettings.value && typeof onlineSettings.value === 'object' ? onlineSettings.value : {}
  const mergedSettings = {
    ...baseSettings,
    ...createUserConfigPayload(),
  }
  VIEWER_SETTING_KEYS.forEach((key) => {
    delete mergedSettings[key]
  })
  return { ...mergedSettings, ...dataSourceViewerSettings.value }
}

const canWriteOnlineSettings = computed(
  () => appMode.value === 'online' && isAuthenticated.value && Boolean(connectionProfile.value),
)

async function onApplyUserConfig() {
  applyUserConfigToRawItems(rawItems.value)
  if (dataMode.value === 'csv') {
    setDataMode('json')
  }
  isDirty.value = rawItems.value.length > 0

  if (!canWriteOnlineSettings.value) {
    return
  }

  await persistOnlineSettings(buildMergedOnlineSettings())
}

// Viewer settings live with the data source, so they can only be edited while one is open.
const canEditViewerSettings = computed(() => {
  if (appMode.value === 'online') {
    return canWriteOnlineSettings.value && Boolean(onlineSettings.value)
  }
  return hasData.value
})

// `nextSettings` = null removes every override, so the basic config applies again.
async function onApplyViewerSettings(nextSettings) {
  if (!canEditViewerSettings.value) {
    return { ok: false, reason: 'no-data-source' }
  }

  setDataSourceViewerSettings(nextSettings || {})

  if (appMode.value === 'online') {
    return persistOnlineSettings(buildMergedOnlineSettings())
  }

  if (dataMode.value === 'csv') {
    setDataMode('json')
  }
  isDirty.value = true
  return { ok: true }
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
  filteredViewItems: navigableViewItems,
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
  initializeUserConfigForCurrentData: initializeUserConfig,
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
  dataSourceViewerSettings,
  setDataSourceViewerSettings,
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

// Border-Box: das Ein-/Ausklappen der Topbar aendert nur das Padding, was die
// Content-Box (Default der ResizeObserver-Beobachtung) unveraendert laesst.
function observeStickyElement(element) {
  if (!stickyResizeObserver || !element) return
  stickyResizeObserver.observe(element, { box: 'border-box' })
}

function updateStickyMeasurements() {
  if (!appShellRef.value) return
  const headerHeight = topbarRef.value?.offsetHeight || 0
  const tabsHeight = appTabsRowRef.value?.offsetHeight || 0
  const stickyTopHeight = editStickyTopRef.value?.offsetHeight || 0
  appShellRef.value.style.setProperty('--ve-header-offset', `${headerHeight}px`)
  appShellRef.value.style.setProperty('--ve-tabs-row-height', `${tabsHeight}px`)
  appShellRef.value.style.setProperty('--ve-edit-sticky-stack-height', `${stickyTopHeight}px`)
}

// Hysterese: Condense-/Expand-Schwelle liegen auseinander, damit die durch das
// Einklappen schrumpfende Dokumenthoehe nicht in ein Flackern zurueckfuehrt.
const TOPBAR_CONDENSE_SCROLL_Y = 24
const TOPBAR_EXPAND_SCROLL_Y = 8

function updateTopbarCondensedState() {
  const scrollY = window.scrollY || window.pageYOffset || 0
  if (!isTopbarCondensed.value && scrollY > TOPBAR_CONDENSE_SCROLL_Y) {
    isTopbarCondensed.value = true
    return
  }
  if (isTopbarCondensed.value && scrollY < TOPBAR_EXPAND_SCROLL_Y) {
    isTopbarCondensed.value = false
  }
}

onMounted(() => {
  document.documentElement.style.setProperty('--color-primary', primaryColor.value)

  // Die Sticky-Offsets der Topbar/Tab-Reihe/Edit-Kopfzeile haengen an den hier
  // gesetzten CSS-Variablen.
  window.addEventListener('resize', updateStickyMeasurements)
  window.addEventListener('scroll', updateTopbarCondensedState, { passive: true })
  stickyResizeObserver = new ResizeObserver(() => {
    updateStickyMeasurements()
  })
  observeStickyElement(topbarRef.value)
  observeStickyElement(appTabsRowRef.value)
  observeStickyElement(editStickyTopRef.value)
  updateTopbarCondensedState()
  updateStickyMeasurements()
  requestAnimationFrame(() => {
    updateStickyMeasurements()
  })

  // The basic config is already loaded (main.js). The profile comes first: the stored app
  // mode only counts as `online` when a profile exists.
  initializeConnectionProfile()
  loadDataModeFromSession()
  loadAppModeFromStorage()
  loadOnlineConfigOnlyFromStorage()

  if (appMode.value === 'online' && !connectionProfile.value) {
    openDatabaseConnectionTab()
  }
  restoreSession()
  window.addEventListener('beforeunload', beforeUnloadListener)
  window.addEventListener('keydown', keydownListener)
})

onBeforeUnmount(() => {
  window.removeEventListener('beforeunload', beforeUnloadListener)
  window.removeEventListener('keydown', keydownListener)
  window.removeEventListener('resize', updateStickyMeasurements)
  window.removeEventListener('scroll', updateTopbarCondensedState)
  if (stickyResizeObserver) {
    stickyResizeObserver.disconnect()
    stickyResizeObserver = null
  }
})

watch(
  () => primaryColor.value,
  (nextPrimaryColor) => {
    document.documentElement.style.setProperty('--color-primary', nextPrimaryColor)
  },
)

watch(
  () => importFileName.value,
  () => {
    failedListImages.value = new Set()
    sidebarImageLoadFailed.value = false
    lightboxImageLoadFailed.value = false
    hasSelectedHierarchyLevel1.value = false
    selectedHierarchyLevel1.value = ''
    expandedHierarchyLevel2Values.value = []
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
  [
    () => appMode.value,
    () => isAuthenticated.value,
    () => hierarchyLevel1Options.value.map((entry) => `${entry.value}:${entry.count}`).join('|'),
  ],
  ([nextMode, nextAuthenticated]) => {
    if (!hierarchyEnabled.value) {
      hasSelectedHierarchyLevel1.value = false
      selectedHierarchyLevel1.value = ''
      expandedHierarchyLevel2Values.value = []
      return
    }

    if (nextMode === 'online' && nextAuthenticated) {
      return
    }

    const options = hierarchyLevel1Options.value
    if (!options.length) {
      hasSelectedHierarchyLevel1.value = false
      selectedHierarchyLevel1.value = ''
      expandedHierarchyLevel2Values.value = []
      return
    }

    if (!hasSelectedHierarchyLevel1.value) {
      expandedHierarchyLevel2Values.value = []
      return
    }

    const hasCurrentSelection = options.some((entry) => entry.value === selectedHierarchyLevel1.value)
    if (hasCurrentSelection) return

    hasSelectedHierarchyLevel1.value = false
    selectedHierarchyLevel1.value = ''
    expandedHierarchyLevel2Values.value = []
  },
)

watch(
  [
    () => selectedHierarchyLevel1.value,
    () => rawItems.value.length,
    () => hierarchyLevel2FieldKey.value,
    () => hierarchyLevel1FieldKey.value,
  ],
  () => {
    if (!hierarchyEnabled.value) return
    if (!hasSelectedHierarchyLevel1.value) {
      expandedHierarchyLevel2Values.value = []
      return
    }
    if (!selectedHierarchyLevel1.value && selectedHierarchyLevel1.value !== '') return

    const availableLevel2Values = buildHierarchyLevel2Options(
      rawItems.value,
      hierarchyLevel1FieldKey.value,
      hierarchyLevel2FieldKey.value,
      selectedHierarchyLevel1.value,
    ).map((entry) => entry.value)

    if (!availableLevel2Values.length) {
      expandedHierarchyLevel2Values.value = []
      return
    }

    const currentExpanded = expandedHierarchyLevel2Values.value
      .map((entry) => normalizeHierarchyValue(entry))
      .filter((entry) => availableLevel2Values.includes(entry))

    if (!currentExpanded.length) {
      expandedHierarchyLevel2Values.value = [availableLevel2Values[0]]
      return
    }

    expandedHierarchyLevel2Values.value = currentExpanded
  },
)

watch(
  () => activeTab.value,
  () => {
    requestAnimationFrame(() => {
      updateStickyMeasurements()
      observeStickyElement(topbarRef.value)
      observeStickyElement(appTabsRowRef.value)
      observeStickyElement(editStickyTopRef.value)
    })
  },
)

watch(
  [
    () => appMode.value,
    () => isAuthenticated.value,
    () => onlineConfigOnly.value,
    () => connectionProfile.value?.baseUrl || '',
    () => connectionProfile.value?.configPath || '',
  ],
  async ([nextMode, nextAuthenticated, nextOnlineConfigOnly]) => {
    if (nextMode !== 'online' || !nextAuthenticated) {
      clearOnlineWording()
      clearDataSourceViewerSettings()
      clearOnlineSettings()
      clearOnlineItems()
      clearOnlineUpdates()
      hasSelectedHierarchyLevel1.value = false
      selectedHierarchyLevel1.value = ''
      expandedHierarchyLevel2Values.value = []
      return
    }

    const result = await fetchOnlineSettings()
    if (!result.ok) {
      clearOnlineWording()
      clearDataSourceViewerSettings()
      return
    }

    setOnlineWording(result.wording)

    const itemsPathFromSettings = resolveItemsPathFromSettings(result.settings)

    initializeFromJsonArray([], itemsPathFromSettings ? `online:${itemsPathFromSettings}` : 'online:settings')
    clearOnlineItems()
    clearOnlineUpdates()
    initializeReplacements(result.replacements)
    hasSelectedHierarchyLevel1.value = false
    selectedHierarchyLevel1.value = ''
    expandedHierarchyLevel2Values.value = []

    const applyResult = applyImportedConfigPayload(result.settings)
    if (!applyResult.ok) {
      clearDataSourceViewerSettings()
      markOnlineSettingsInvalid(applyResult.error)
      return
    }

    setDataSourceViewerSettings(result.settings)
    applyUserConfigToRawItems(rawItems.value)

    if (nextOnlineConfigOnly) {
      return
    }

    const itemsResult = await fetchOnlineItems({ settings: result.settings })
    if (!itemsResult.ok) return

    initializeFromJsonArray(itemsResult.items, `online:${itemsResult.itemsPath}`)
    applyUserConfigToRawItems(rawItems.value)
    clearOnlineUpdates()
    hasSelectedHierarchyLevel1.value = false
    selectedHierarchyLevel1.value = ''
    expandedHierarchyLevel2Values.value = []

    if (itemsResult.hierarchyEnabled) {
      return
    }
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
    <header ref="topbarRef" class="topbar content-grid-topbar content-grid-full"
      :class="{ 'topbar-condensed': isTopbarCondensed }">
      <h1>{{ t('appTitle', 'Viewer Editor') }}</h1>
      <div class="actions">
        <OnlineAccessPanel
          :has-pending-online-updates="hasPendingOnlineChanges"
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
          @reset="onReset" @load-sample-data="onLoadSampleData" />
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
            {{ t('tabDatabaseConnection', 'Settings') }}
          </button>
          <button id="tab-info" type="button" class="app-tab-btn" role="tab" aria-controls="panel-info"
            :aria-selected="activeTab === 'info'" :tabindex="activeTab === 'info' ? 0 : -1"
            :class="{ active: activeTab === 'info' }" @click="setActiveTab('info')"
            @keydown="onTabKeydown($event, 'info')">
            {{ t('tabInfo', 'Info') }}
          </button>
        </nav>
        <div v-if="showLanguageSwitch" class="language-switch" :aria-label="t('languageSwitchAria', 'Sprache waehlen')">
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
          :hierarchy-fields="hierarchicalFields"
          :hierarchy-level1-options="hierarchyLevel1Options"
          :selected-hierarchy-level1="selectedHierarchyLevel1"
          :has-selected-hierarchy-level1="hasSelectedHierarchyLevel1"
          :expanded-hierarchy-level2-values="expandedHierarchyLevel2Values"
          :hierarchy-unassigned-label="t('hierarchyUnassignedLabel', 'Ohne Zuordnung')"
          :hierarchy-select-level1-label="t('hierarchySelectLevel1Label', 'Bitte waehlen Sie zuerst eine Kategorie.')"
          :hierarchy-collapse-all-label="t('hierarchyCollapseAllLabel', 'Alle Unterkategorien einklappen')"
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
             :hierarchy-fields="hierarchicalFields"
             :hierarchy-level1-options="hierarchyLevel1Options"
             :selected-hierarchy-level1="selectedHierarchyLevel1"
             :has-selected-hierarchy-level1="hasSelectedHierarchyLevel1"
             :expanded-hierarchy-level2-values="expandedHierarchyLevel2Values"
             :hierarchy-unassigned-label="t('hierarchyUnassignedLabel', 'Ohne Zuordnung')"
             :hierarchy-select-level1-label="t('hierarchySelectLevel1Label', 'Bitte waehlen Sie zuerst eine Kategorie.')"
             :hierarchy-collapse-all-label="t('hierarchyCollapseAllLabel', 'Alle Unterkategorien einklappen')"
             :looks-like-image-url="looksLikeImageUrl" :has-list-image-failed="hasListImageFailed" :render-header="false"
             :render-body="true" @clear-selection="clearSelection" @select-item="selectItem"
             @update:search-query="searchQuery = $event" @list-image-failed="listImageFailed"
             @toggle-suspend-editing="onSuspendEditingToggle" @hierarchy-select-level1="onSelectHierarchyLevel1"
             @hierarchy-toggle-level2="onToggleHierarchyLevel2" @hierarchy-collapse-all="onCollapseAllHierarchyLevel2" />

          <aside v-if="selectedRawItem" class="sidebar-panel">
            <div class="sidebar-head">
              <div class="sidebar-nav" v-if="navigableViewItems.length > 1">
                <button type="button" :disabled="!canGoPrevious" @click="selectPreviousItem"
                  :aria-label="t('sidebarPreviousItemAria', 'Vorheriges Item')">
                  ←
                </button>
                <span class="scan-nav-index">{{ t('sidebarScanCounterPrefix', 'Scan') }} {{ selectedFilteredIndex + 1 }}
                  /
                  {{ navigableViewItems.length }}</span>
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
              <div class="sidebar-head-actions">
                <label class="sidebar-suspend-toggle" for="sidebar-suspend-editing">
                  <span>{{ t('suspendEditingLabel', 'Bearbeitung aussetzen') }}</span>
                  <input
                    :key="selectedViewItem?._uid || 'sidebar-suspend-editing'"
                    id="sidebar-suspend-editing"
                    type="checkbox"
                    :checked="isSidebarSuspendEditingChecked"
                    @change="onSidebarSuspendEditingChange"
                  />
                </label>
                <button type="button" class="sidebar-close" @click="onSidebarClose"
                  :aria-label="t('sidebarCloseAria', 'Sidebar schliessen')">
                  ×
                </button>
              </div>
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
                  <ItemFieldEditor class="sidebar-checkbox-fields" :selected-raw-item="selectedRawItem"
                    :selected-view-item="selectedViewItem" :include-configured-types="['checkbox']"
                    :is-editable-simple-value="isEditableSimpleValue" @field-change="onFieldChange"
                    @accept-candidate="onAcceptCandidate" />
                </div>

                <ItemFieldEditor :selected-raw-item="selectedRawItem" :selected-view-item="selectedViewItem"
                  :exclude-configured-types="hasScanField ? ['checkbox'] : []"
                  :show-raw-data-dev-preview="dataInspectionMode"
                  :raw-data-toggle-label="t('rawDataToggleLabel', 'show raw data')"
                  :raw-data-hide-label="t('rawDataHideLabel', 'hide raw data')"
                  :copy-raw-data-label="t('copyRawDataLabel', 'Copy raw data')"
                  :candidate-apply-to-label="t('candidateApplyToLabel', 'Uebernehmen in')"
                  :candidate-choose-target-label="t('candidateChooseTargetLabel', 'Bitte Ziel-Feld in Konfiguration waehlen')"
                  :candidate-autosuggest-prefills="candidateAutosuggestPrefills"
                  :is-editable-simple-value="isEditableSimpleValue" @field-change="onFieldChange"
                  @accept-candidate="onAcceptCandidate" />
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
          <ConfigurationPanel :has-data="hasData" :allow-without-data="canConfigureWithoutData"
            :data-field-keys="availableFieldKeys" @apply="onApplyUserConfig" />
        </section>

        <section v-if="activeTab === 'replacements'" id="panel-replacements"
          class="replacements-tab-panel tab-sheet-panel" role="tabpanel" aria-labelledby="tab-replacements">
          <ReplacementsPanel @apply-replacements="onApplyReplacements" />
        </section>

        <section v-if="activeTab === 'database-connection'" id="panel-database-connection"
          class="database-connection-tab-panel tab-sheet-panel" role="tabpanel" aria-labelledby="tab-database-connection">
          <DatabaseConnectionPanel :can-edit-viewer-settings="canEditViewerSettings"
            :apply-viewer-settings="onApplyViewerSettings" />
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
