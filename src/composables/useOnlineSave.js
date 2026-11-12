// "Änderungen speichern" online: the pending item creates/updates, then the changed replacement
// rules. Resolves to true only when everything pending was saved, so callers (e.g. "derive item")
// can wait for a complete save.
import { useAuthStore } from '../stores/useAuthStore'
import { useConnectionProfileStore } from '../stores/useConnectionProfileStore'
import { useOnlineModeStore } from '../stores/useOnlineModeStore'
import { useOnlineSettingsStore } from '../stores/useOnlineSettingsStore'
import { useOnlineUpdatesStore } from '../stores/useOnlineUpdatesStore'
import { useReplacementsStore } from '../stores/useReplacementsStore'
import { usePendingOnlineChangesGuard } from './usePendingOnlineChangesGuard'

/**
 * @param {object} viewerData From useViewerData: `rawItems`, `importFileName`, `markAsSaved`,
 *   `syncSnapshotItemAtIndex`.
 */
export function useOnlineSave({ rawItems, importFileName, markAsSaved, syncSnapshotItemAtIndex }) {
  const { appMode } = useOnlineModeStore()
  const { isAuthenticated, token } = useAuthStore()
  const { connectionProfile } = useConnectionProfileStore()
  const { persistOnlineReplacements } = useOnlineSettingsStore()
  const { hasPendingUpdates, saveOnlineUpdates, saveOnlineItem, hasPendingChangesForItem } = useOnlineUpdatesStore()
  const { hasReplacementsChanges, createReplacementsPayload, markReplacementsAsSaved } = useReplacementsStore()
  const { hasPendingOnlineChanges } = usePendingOnlineChangesGuard()

  function canWrite() {
    return appMode.value === 'online' && isAuthenticated.value && Boolean(connectionProfile.value)
  }

  async function persistReplacementRulesIfChanged() {
    if (!hasReplacementsChanges.value) return true
    const result = await persistOnlineReplacements(createReplacementsPayload())
    if (result?.ok) markReplacementsAsSaved()
    return Boolean(result?.ok)
  }

  // After a partly failed save, the items created so far keep their new server state.
  function syncCreatedItemSnapshots(createdItems) {
    if (!Array.isArray(createdItems)) return
    createdItems.forEach((createdItem) => {
      const createdIndex = rawItems.value.indexOf(createdItem)
      if (createdIndex !== -1) syncSnapshotItemAtIndex(createdIndex)
    })
  }

  async function saveOnlineChanges() {
    if (!canWrite()) return false
    if (!hasPendingOnlineChanges.value) return true
    if (!hasPendingUpdates.value) return persistReplacementRulesIfChanged()

    const result = await saveOnlineUpdates({ profile: connectionProfile.value, token: token.value || '' })
    const rulesSaved = await persistReplacementRulesIfChanged()

    if (result.ok) {
      markAsSaved(importFileName.value)
      return rulesSaved
    }
    syncCreatedItemSnapshots(result.createdItems)
    return false
  }

  // "Save item": only this item's pending create or update; the rest stays pending.
  async function saveOnlineItemChanges(item) {
    if (!canWrite()) return false
    if (!hasPendingChangesForItem(item)) return true

    const result = await saveOnlineItem({ profile: connectionProfile.value, token: token.value || '', item })
    if (!result.ok) return false

    const itemIndex = rawItems.value.indexOf(item)
    if (itemIndex !== -1) syncSnapshotItemAtIndex(itemIndex)
    if (!hasPendingOnlineChanges.value) markAsSaved(importFileName.value)
    return true
  }

  return { saveOnlineChanges, saveOnlineItemChanges }
}
