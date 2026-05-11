import { computed } from 'vue'

export function useSelectionNavigation({ filteredViewItems, selectedViewItem, selectItem }) {
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

  function clearSelection() {
    selectItem(null)
  }

  return {
    selectedFilteredIndex,
    canGoPrevious,
    canGoNext,
    selectPreviousItem,
    selectNextItem,
    clearSelection,
  }
}
