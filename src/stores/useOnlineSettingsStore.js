import { computed, ref } from 'vue'
import { updateViewerReplacementsInStrapi, updateViewerSettingsInStrapi } from '../services/strapiApi'
import {
  fetchViewerSettingsRecordFromStrapi,
  updateCollectionConfigInStrapi,
} from '../services/strapiCollectionConfig'
import {
  LAYOUT_V1,
  LAYOUT_V2,
  collectionConfigToSettings,
  mergeReplacementsIntoCollectionConfig,
  mergeSettingsIntoCollectionConfig,
  readViewerSettingsLayout,
} from '../services/viewerSettingsLayout'
import { VIEWER_SETTING_KEYS, useAppConfigStore } from './useAppConfigStore'
import { useAuthStore } from './useAuthStore'
import { useConnectionProfileStore } from './useConnectionProfileStore'

// `settings` is always v1-shaped (one collection): in layout v2 it is the primary collection's
// attribute. See services/viewerSettingsLayout.js.
const settings = ref(null)
const wording = ref({})
const settingsStatus = ref('idle')
const lastSettingsError = ref('')
const layout = ref(LAYOUT_V1)
const primaryCollectionId = ref('')
// Layout v2: `[{ id, config, error }]` per secondary collection of the basic config.
const secondaryCollections = ref([])

function clearOnlineSettings() {
  settings.value = null
  wording.value = {}
  settingsStatus.value = 'idle'
  lastSettingsError.value = ''
  layout.value = LAYOUT_V1
  primaryCollectionId.value = ''
  secondaryCollections.value = []
}

function markOnlineSettingsInvalid(message) {
  settingsStatus.value = 'error'
  lastSettingsError.value = String(message || 'Online settings payload is invalid.')
}

function describeError(error, fallback) {
  const message = typeof error?.message === 'string' ? error.message.trim() : ''
  return message || fallback
}

/**
 * Runs one request against the viewer-settings record with the saved profile and token, and keeps
 * `settingsStatus` / `lastSettingsError` in step. Resolves to `{ ok: true, ...result }` or
 * `{ ok: false, error }`.
 */
async function runSettingsRequest(fallbackError, request) {
  const { connectionProfile } = useConnectionProfileStore()
  const { token } = useAuthStore()

  if (!connectionProfile.value) {
    markOnlineSettingsInvalid('No saved connection profile found.')
    return { ok: false, error: lastSettingsError.value }
  }

  settingsStatus.value = 'loading'
  lastSettingsError.value = ''
  try {
    const result = await request({ profile: connectionProfile.value, token: token.value || '' })
    settingsStatus.value = 'ready'
    return { ok: true, ...result }
  } catch (error) {
    markOnlineSettingsInvalid(describeError(error, fallbackError))
    return { ok: false, error: lastSettingsError.value }
  }
}

function readLayoutOptions() {
  const { primaryCollection, secondaryCollections: secondaryIds } = useAppConfigStore()
  return {
    primaryCollection: primaryCollection.value,
    secondaryCollections: secondaryIds.value,
    omitKeys: VIEWER_SETTING_KEYS,
  }
}

async function fetchOnlineSettings() {
  const result = await runSettingsRequest('Could not load online settings.', async (connection) => {
    const record = await fetchViewerSettingsRecordFromStrapi(connection)
    const read = readViewerSettingsLayout(record, readLayoutOptions())
    return {
      ...read,
      wording: record.wording && typeof record.wording === 'object' ? record.wording : {},
      // Derivation rules: own JSON prop, raw here (see composables/derivationRules.js).
      mappings: record.mappings ?? null,
    }
  })

  if (!result.ok) {
    clearLoadedSettings()
    return result
  }
  settings.value = result.settings
  wording.value = result.wording
  layout.value = result.layout
  primaryCollectionId.value = result.primaryId
  secondaryCollections.value = result.secondaries
  return result
}

function clearLoadedSettings() {
  settings.value = null
  wording.value = {}
  secondaryCollections.value = []
}

const isCollectionLayout = computed(() => layout.value === LAYOUT_V2)

function updatePrimaryCollection(connection, update) {
  return updateCollectionConfigInStrapi({ ...connection, collectionId: primaryCollectionId.value, update })
}

async function persistOnlineSettings(nextSettings) {
  const result = await runSettingsRequest('Could not save online settings.', async (connection) => {
    if (!isCollectionLayout.value) {
      return updateViewerSettingsInStrapi({ ...connection, settings: nextSettings })
    }
    const { config, payload } = await updatePrimaryCollection(connection, (current) =>
      mergeSettingsIntoCollectionConfig(current, nextSettings, VIEWER_SETTING_KEYS),
    )
    return { payload, settings: collectionConfigToSettings(config, VIEWER_SETTING_KEYS) }
  })
  if (!result.ok) return result

  settings.value = result.settings
  if (result.wording && typeof result.wording === 'object') {
    wording.value = result.wording
  }
  return { ok: true, settings: result.settings, wording: wording.value, payload: result.payload }
}

async function persistOnlineReplacements(nextReplacements) {
  const result = await runSettingsRequest('Could not save replacements.', async (connection) => {
    if (!isCollectionLayout.value) {
      return updateViewerReplacementsInStrapi({ ...connection, replacements: nextReplacements })
    }
    const { config, payload } = await updatePrimaryCollection(connection, (current) =>
      mergeReplacementsIntoCollectionConfig(current, nextReplacements),
    )
    return { payload, replacements: config.replacements }
  })
  if (!result.ok) return result
  return { ok: true, replacements: result.replacements, payload: result.payload }
}

/** Layout v2: writes the field configuration of a secondary collection into its own attribute. */
async function persistSecondaryCollectionSettings(collectionId, nextSettings) {
  const result = await runSettingsRequest('Could not save the collection settings.', (connection) =>
    updateCollectionConfigInStrapi({
      ...connection,
      collectionId,
      update: (current) => mergeSettingsIntoCollectionConfig(current, nextSettings, VIEWER_SETTING_KEYS),
    }),
  )
  if (!result.ok) return result

  secondaryCollections.value = secondaryCollections.value.map((entry) =>
    entry.id === collectionId ? { ...entry, config: result.config, error: '' } : entry,
  )
  return { ok: true, config: result.config }
}

export function useOnlineSettingsStore() {
  return {
    settings,
    wording,
    settingsStatus,
    lastSettingsError,
    layout,
    isCollectionLayout,
    primaryCollectionId,
    secondaryCollections,
    clearOnlineSettings,
    markOnlineSettingsInvalid,
    fetchOnlineSettings,
    persistOnlineSettings,
    persistOnlineReplacements,
    persistSecondaryCollectionSettings,
  }
}
