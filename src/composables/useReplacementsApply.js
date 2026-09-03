import { hasReplacementRules } from './replacementRules'
import { useReplacementsStore } from '../stores/useReplacementsStore'

const ONLINE_META_KEY = '__onlineMeta'

/**
 * Runs the replacement rules over the data.
 *
 * Offline the run covers the loaded items. Online it covers the whole
 * collection: loaded items change in place and become regular field deltas,
 * every other item of the collection is fetched, matched and registered as a
 * pending update. Nothing is written to Strapi here - the run only produces
 * pending changes that the normal save writes.
 */
export function useReplacementsApply({
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
}) {
  const {
    replacements,
    beginReplacementsApply,
    finishReplacementsApply,
    failReplacementsApply,
  } = useReplacementsStore()

  function isOnlineRun() {
    return (
      appMode.value === 'online' &&
      isAuthenticated.value &&
      Boolean(connectionProfile.value) &&
      Boolean(onlineSettings.value)
    )
  }

  function collectLoadedOnlineIds() {
    const ids = []
    rawItems.value.forEach((item) => {
      const id = item?.[ONLINE_META_KEY]?.id
      if (id) ids.push(id)
    })
    return ids
  }

  function trackLoadedChangesAsOnlineDeltas(changes) {
    changes.forEach(({ index, changedFields }) => {
      const item = rawItems.value[index]
      if (!item) return
      const snapshotItem = importSnapshot.value[index] || {}
      Object.keys(changedFields).forEach((key) => {
        trackOnlineFieldChange({ item, snapshotItem, key, nextValue: item[key] })
      })
    })
  }

  async function applyReplacementsNow() {
    beginReplacementsApply()

    const fieldConfigs = replacementFieldConfigs.value || {}

    if (!hasReplacementRules(replacements.value)) {
      finishReplacementsApply({
        online: false,
        changedItemCount: 0,
        changedFieldCount: 0,
        remoteScannedCount: 0,
        remoteChangedItemCount: 0,
        remoteChangedFieldCount: 0,
      })
      return { ok: true }
    }

    const localResult = applyReplacementsToLoadedItems(replacements.value, fieldConfigs)

    if (!isOnlineRun()) {
      finishReplacementsApply({
        online: false,
        changedItemCount: localResult.changedItemCount,
        changedFieldCount: localResult.changedFieldCount,
        remoteScannedCount: 0,
        remoteChangedItemCount: 0,
        remoteChangedFieldCount: 0,
      })
      return { ok: true }
    }

    trackLoadedChangesAsOnlineDeltas(localResult.changes)

    const remoteResult = await trackOnlineReplacementUpdatesForRemainingItems({
      profile: connectionProfile.value,
      token: token.value || '',
      settings: onlineSettings.value,
      replacements: replacements.value,
      fieldConfigs,
      loadedIds: collectLoadedOnlineIds(),
    })

    if (!remoteResult.ok) {
      failReplacementsApply(remoteResult.error)
      return { ok: false, error: remoteResult.error }
    }

    finishReplacementsApply({
      online: true,
      changedItemCount: localResult.changedItemCount,
      changedFieldCount: localResult.changedFieldCount,
      remoteScannedCount: remoteResult.scannedCount || 0,
      remoteChangedItemCount: remoteResult.changedItemCount || 0,
      remoteChangedFieldCount: remoteResult.changedFieldCount || 0,
    })
    return { ok: true }
  }

  return {
    applyReplacementsNow,
  }
}
