// Layout v2: the items of each secondary collection that are linked to the selected primary item.
// They are loaded per selection, edited with their collection's field configuration and saved as
// regular pending updates (see useOnlineUpdatesStore), so the shared Save button includes them.
import { ref, watch } from 'vue'
import { fetchLinkedItemsFromStrapi } from '../services/strapiCollectionConfig'
import { fetchRelationAttributeFromStrapi } from '../services/strapiDataModel'
import {
  getWikidataAutosuggestFieldKeysFromSettings,
  normalizeStrapiItem,
  resolveScanFieldFromSettings,
} from '../services/strapiApi'
import { normalizeUpdatedFieldValue } from '../fields/fieldRegistry'
import { mergeOnlineSettings } from '../services/viewerSettingsLayout'
import { VIEWER_SETTING_KEYS } from '../stores/useAppConfigStore'
import { useAuthStore } from '../stores/useAuthStore'
import { useConnectionProfileStore } from '../stores/useConnectionProfileStore'
import { useOnlineModeStore } from '../stores/useOnlineModeStore'
import { useOnlineSettingsStore } from '../stores/useOnlineSettingsStore'
import { useOnlineUpdatesStore } from '../stores/useOnlineUpdatesStore'
import { clearSecondaryUserConfigScopes, useUserConfigStore } from '../stores/useUserConfigStore'
import { createRequestSequence } from './requestSequence'
import { linkedItemKey, prepareLinkedItem, resolveLinkTarget, secondaryConfigScope } from './linkedItems'

function samePath(left, right) {
  const normalize = (path) => String(path || '').split('?')[0].replace(/\/+$/, '')
  return normalize(left) === normalize(right)
}

function cloneValue(value) {
  return JSON.parse(JSON.stringify(value))
}

/**
 * @param {object} options
 * @param {import('vue').Ref<object|null>} options.selectedItem the selected primary item
 * @param {(item: object) => Promise<boolean>} options.saveItem saves one item's pending changes
 */
export function useSecondaryItems({ selectedItem, saveItem }) {
  const { appMode } = useOnlineModeStore()
  const { token, isAuthenticated } = useAuthStore()
  const { connectionProfile } = useConnectionProfileStore()
  const settingsStore = useOnlineSettingsStore()
  const updatesStore = useOnlineUpdatesStore()

  // [{ id, scope, label, settings, error, status: 'idle'|'loading'|'ready'|'error', items, openKeys }]
  const sections = ref([])
  // Key of the linked item whose own Save is running ('' = none).
  const savingKey = ref('')
  const snapshotsByKey = new Map()
  const relationsById = new Map()
  const loads = createRequestSequence()

  // Online, signed in, and the settings use the collection layout.
  function isEnabled() {
    const isOnline = appMode.value === 'online' && isAuthenticated.value
    return isOnline && settingsStore.isCollectionLayout.value
  }

  function connection() {
    return { profile: connectionProfile.value, token: token.value || '' }
  }

  function buildSection({ id, config, error }) {
    const scope = secondaryConfigScope(id)
    const section = { id, scope, label: config?.label || null, settings: null, error, status: 'idle', items: [], openKeys: [] }
    if (!config) return section

    const applied = useUserConfigStore(scope).applyImportedConfigPayload(config)
    if (!applied.ok) return { ...section, error: applied.error || `The configuration of "${id}" is invalid.` }
    return { ...section, settings: config }
  }

  /** Reads the secondary collections of the loaded settings; called after every settings load. */
  function initialize() {
    clear()
    if (!isEnabled()) return
    sections.value = settingsStore.secondaryCollections.value.map(buildSection)
    loadForSelection()
  }

  function clear() {
    loads.invalidate()
    clearSecondaryUserConfigScopes()
    relationsById.clear()
    snapshotsByKey.clear()
    sections.value = []
  }

  // The secondary collection's attribute that points to the primary one: configured or from the schema.
  async function resolveRelation(section) {
    const configured = section.settings.relations?.[settingsStore.primaryCollectionId.value]
    if (configured) return String(configured)
    if (!relationsById.has(section.id)) {
      relationsById.set(
        section.id,
        await fetchRelationAttributeFromStrapi({
          ...connection(),
          fromItemsPath: section.settings.itemsPath,
          toItemsPath: settingsStore.settings.value?.itemsPath,
        }),
      )
    }
    return relationsById.get(section.id)
  }

  function toLinkedItem(section, row) {
    const { settings } = section
    const fieldConfigs = useUserConfigStore(section.scope).appliedUserConfigFields.value
    const serverItem = prepareLinkedItem(
      normalizeStrapiItem(row, fieldConfigs, settings.itemsPath, resolveScanFieldFromSettings(settings)),
      fieldConfigs,
    )
    const key = linkedItemKey(serverItem)
    snapshotsByKey.set(key, cloneValue(serverItem))
    // Unsaved edits made earlier stay: the edited object is still the pending entry's item.
    const meta = serverItem.__onlineMeta
    return updatesStore.findPendingUpdateItem(meta.itemsPath, meta.id) || serverItem
  }

  async function fetchSectionItems(section, linkedTo) {
    const relationAttribute = await resolveRelation(section)
    if (!relationAttribute) {
      throw new Error(
        `No relation from "${section.id}" to the primary collection found. Name it in ${section.id}.relations.`,
      )
    }
    return fetchLinkedItemsFromStrapi({
      ...connection(),
      itemsPath: section.settings.itemsPath,
      relationAttribute,
      linkedTo,
      populateFields: getWikidataAutosuggestFieldKeysFromSettings(section.settings),
    })
  }

  async function loadSection(section, linkedTo, isCurrent, openId = '') {
    section.status = 'loading'
    section.error = ''
    try {
      const rows = await fetchSectionItems(section, linkedTo)
      if (!isCurrent()) return
      section.items = rows.map((row) => toLinkedItem(section, row))
      section.openKeys = section.items
        .filter((item) => openId && String(item.__onlineMeta?.id) === String(openId))
        .map(linkedItemKey)
      section.status = 'ready'
    } catch (error) {
      if (!isCurrent()) return
      section.status = 'error'
      section.error = String(error?.message || error)
    }
  }

  function loadForSelection({ collectionPath = '', openId = '' } = {}) {
    const isCurrent = loads.start()
    const linkedTo = resolveLinkTarget(selectedItem.value)
    sections.value.forEach((section) => {
      if (!section.settings) return
      if (!linkedTo) {
        section.items = []
        section.status = 'idle'
        return
      }
      const isTarget = Boolean(collectionPath) && samePath(section.settings.itemsPath, collectionPath)
      loadSection(section, linkedTo, isCurrent, isTarget ? openId : '')
    })
  }

  /** After "derive item": reloads the sections and opens the new item. */
  function reloadAfterCreate({ targetPath, documentId }) {
    loadForSelection({ collectionPath: targetPath, openId: documentId })
  }

  function changeField(item, key, rawValue, configuredType) {
    const result = normalizeUpdatedFieldValue(item[key], rawValue, configuredType)
    if (!result.ok) return
    item[key] = result.value
    updatesStore.trackOnlineFieldChange({
      item,
      snapshotItem: snapshotsByKey.get(linkedItemKey(item)),
      key,
      nextValue: item[key],
    })
  }

  // A saved item's current values are its new server state.
  function syncSavedSnapshots() {
    sections.value.forEach((section) => {
      section.items.forEach((item) => {
        if (!updatesStore.hasPendingChangesForItem(item)) snapshotsByKey.set(linkedItemKey(item), cloneValue(item))
      })
    })
  }

  /**
   * "Konfiguration anwenden" on a secondary collection's tab: applies the edited configuration to
   * the loaded items and writes it into the collection's own attribute.
   */
  async function applyCollectionConfig(section) {
    const store = useUserConfigStore(section.scope)
    store.applyUserConfigToRawItems(section.items)
    const next = mergeOnlineSettings(section.settings, store.createUserConfigPayload(), {
      viewerSettingKeys: VIEWER_SETTING_KEYS,
    })
    const result = await settingsStore.persistSecondaryCollectionSettings(section.id, next)
    if (result.ok) section.settings = result.config
    return result
  }

  async function saveLinkedItem(item) {
    savingKey.value = linkedItemKey(item)
    try {
      await saveItem(item)
    } finally {
      savingKey.value = ''
    }
  }

  function toggleOpen(section, key) {
    section.openKeys = section.openKeys.includes(key)
      ? section.openKeys.filter((entry) => entry !== key)
      : [...section.openKeys, key]
  }

  function setAllOpen(section, isOpen) {
    section.openKeys = isOpen ? section.items.map(linkedItemKey) : []
  }

  watch(() => resolveLinkTarget(selectedItem.value)?.id || '', () => loadForSelection())
  watch(() => updatesStore.pendingUpdateCount.value, syncSavedSnapshots)

  return {
    sections,
    savingKey,
    initialize,
    clear,
    reloadAfterCreate,
    changeField,
    saveLinkedItem,
    applyCollectionConfig,
    toggleOpen,
    setAllOpen,
  }
}
