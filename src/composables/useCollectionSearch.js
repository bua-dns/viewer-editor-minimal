import { computed, ref } from 'vue'
import { isSearchQueryActive, normalizeSearchQuery } from './searchQuery'
import { isItemInHierarchyLevel1 } from './hierarchyConfig'

/**
 * Search scope in the hierarchy view. Inside a selected level-1 category the search is local to it;
 * without a selection it covers the whole collection. A switch overrides the local default.
 *
 * - Offline all items are in memory, so the whole-collection search is a live filter.
 * - Online it is a server search, started explicitly (`submitSearch`), whose hits replace the
 *   loaded items. `runOnlineSearch(query)` and `returnToCategories()` are supplied by the caller,
 *   which owns the item loading and the pending-changes guard; both resolve to `{ ok, error? }`.
 */
export function useCollectionSearch({
  isOnlineSession,
  hasData,
  hierarchyEnabled,
  hasSelectedHierarchyLevel1,
  selectedHierarchyLevel1,
  hierarchyLevel1FieldKey,
  searchQuery,
  filteredViewItems,
  rawItems,
  runOnlineSearch,
  returnToCategories,
}) {
  const scopeOverride = ref(false)
  // The query whose server hits are loaded; empty while the category view is shown.
  const onlineResultsQuery = ref('')
  const isSearching = ref(false)
  const searchError = ref('')
  const droppedFieldKeys = ref([])

  const isGlobalScope = computed(
    () => hierarchyEnabled.value && (!hasSelectedHierarchyLevel1.value || scopeOverride.value),
  )
  const needsSubmit = computed(() => isOnlineSession.value && isGlobalScope.value)

  const showSearchResults = computed(() => {
    if (!hierarchyEnabled.value) return false
    if (isOnlineSession.value) return onlineResultsQuery.value !== ''
    return isGlobalScope.value && isSearchQueryActive(searchQuery.value)
  })

  // What the list shows and prev/next walks through: the hits, or the hits inside the category.
  const navigableViewItems = computed(() => {
    const showsCategory = hierarchyEnabled.value && hasSelectedHierarchyLevel1.value && !showSearchResults.value
    if (!showsCategory) return filteredViewItems.value
    return filteredViewItems.value.filter((viewItem) =>
      isItemInHierarchyLevel1(rawItems.value[viewItem._index], hierarchyLevel1FieldKey.value, selectedHierarchyLevel1.value),
    )
  })

  // Everything the list panel needs to render the search controls and the result view.
  const panelState = computed(() => ({
    enabled: hasData.value || needsSubmit.value,
    showScopeSwitch: hierarchyEnabled.value,
    scopeGlobal: isGlobalScope.value,
    scopeOverride: scopeOverride.value,
    canOverrideScope: hasSelectedHierarchyLevel1.value,
    needsSubmit: needsSubmit.value,
    showResults: showSearchResults.value,
    running: isSearching.value,
    error: searchError.value,
    droppedFieldKeys: droppedFieldKeys.value,
  }))

  function clearSearchResults() {
    onlineResultsQuery.value = ''
    searchError.value = ''
    droppedFieldKeys.value = []
  }

  async function leaveSearchResults() {
    if (!isOnlineSession.value) {
      searchQuery.value = ''
      return
    }
    if (!onlineResultsQuery.value) return
    const result = await returnToCategories()
    if (result?.ok) clearSearchResults()
  }

  async function submitSearch() {
    if (!needsSubmit.value || isSearching.value) return
    const query = normalizeSearchQuery(searchQuery.value)
    if (!isSearchQueryActive(query)) {
      await leaveSearchResults()
      return
    }

    isSearching.value = true
    searchError.value = ''
    try {
      const result = await runOnlineSearch(query)
      if (result?.ok) {
        onlineResultsQuery.value = query
        droppedFieldKeys.value = result.droppedFieldKeys || []
      } else if (result?.error) {
        searchError.value = result.error
      }
    } finally {
      isSearching.value = false
    }
  }

  async function setScopeOverride(value) {
    scopeOverride.value = Boolean(value)
    // Online, back to the local scope inside a category: load that category again. Offline the
    // category view returns by itself, with the query kept as its filter.
    const isBackToLocalScope = !scopeOverride.value && hasSelectedHierarchyLevel1.value
    if (isOnlineSession.value && isBackToLocalScope) await leaveSearchResults()
  }

  return {
    scopeOverride,
    isGlobalScope,
    needsSubmit,
    showSearchResults,
    navigableViewItems,
    panelState,
    isSearching,
    searchError,
    droppedFieldKeys,
    submitSearch,
    leaveSearchResults,
    setScopeOverride,
    clearSearchResults,
  }
}
