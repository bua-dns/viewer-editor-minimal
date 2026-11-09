import { computed } from 'vue'
import { useAppConfigStore } from '../stores/useAppConfigStore'
import { useAuthStore } from '../stores/useAuthStore'
import { useOnlineModeStore } from '../stores/useOnlineModeStore'
import { useOnlineUpdatesStore } from '../stores/useOnlineUpdatesStore'
import { useReplacementsStore } from '../stores/useReplacementsStore'

/**
 * Unsaved online work: item edits and new items (pending updates) plus changed replacement rules.
 * Every action that reloads or leaves the online data (logout, offline mode, config-only toggle,
 * another connection profile, another level-1 group) asks before dropping it.
 */
export function usePendingOnlineChangesGuard() {
  const { t } = useAppConfigStore()
  const { appMode } = useOnlineModeStore()
  const { hasOnlineSession } = useAuthStore()
  const { hasPendingUpdates } = useOnlineUpdatesStore()
  const { hasReplacementsChanges } = useReplacementsStore()

  const isOnlineSession = computed(() => appMode.value === 'online' && hasOnlineSession.value)
  const hasPendingOnlineChanges = computed(
    () => isOnlineSession.value && (hasPendingUpdates.value || hasReplacementsChanges.value),
  )

  /** `includeReplacements: false` for actions that keep the replacement rules (group switch). */
  function confirmDiscardPendingOnlineChanges({ includeReplacements = true } = {}) {
    const hasPending = includeReplacements
      ? hasPendingOnlineChanges.value
      : isOnlineSession.value && hasPendingUpdates.value
    if (!hasPending) return true
    return globalThis.confirm(
      t('onlineDiscardPendingConfirm', 'Unsaved online changes will be discarded. Continue?'),
    )
  }

  return { isOnlineSession, hasPendingOnlineChanges, confirmDiscardPendingOnlineChanges }
}
