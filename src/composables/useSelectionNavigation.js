import { computed } from 'vue'

export function useSelectionNavigation({ filteredViewItems, selectedViewItem, selectItem }) {
  function resolveSelectedUid() {
    return selectedViewItem.value?._uid || null
  }

  function resolveSelectedIndex() {
    const selectedUid = resolveSelectedUid()
    if (!selectedUid) return -1
    return filteredViewItems.value.findIndex((item) => item._uid === selectedUid)
  }

  const selectedFilteredIndex = computed(() => {
    return resolveSelectedIndex()
  })

  const canGoPrevious = computed(() => selectedFilteredIndex.value > 0)
  const canGoNext = computed(
    () => selectedFilteredIndex.value !== -1 && filteredViewItems.value.length > 1,
  )

  function selectPreviousItem() {
    const currentIndex = resolveSelectedIndex()
    if (currentIndex <= 0) return
    const previousItem = filteredViewItems.value[currentIndex - 1]
    if (previousItem) selectItem(previousItem._uid)
  }

  function selectNextItem() {
    const currentIndex = resolveSelectedIndex()
    if (currentIndex === -1) return
    const nextIndex = (currentIndex + 1) % filteredViewItems.value.length
    const nextItem = filteredViewItems.value[nextIndex]
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
