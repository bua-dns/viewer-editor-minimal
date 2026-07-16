import { describe, expect, test, vi } from 'vitest'
import { ref } from 'vue'
import { useSelectionNavigation } from './useSelectionNavigation'

describe('useSelectionNavigation', () => {
  test('navigates using latest filtered order after reorder', () => {
    const filteredViewItems = ref([
      { _uid: 'a' },
      { _uid: 'b' },
      { _uid: 'c' },
    ])
    const selectedViewItem = ref({ _uid: 'b' })
    const selectItem = vi.fn()

    const navigation = useSelectionNavigation({ filteredViewItems, selectedViewItem, selectItem })

    filteredViewItems.value = [{ _uid: 'a' }, { _uid: 'c' }, { _uid: 'b' }]

    expect(navigation.selectedFilteredIndex.value).toBe(2)
    expect(navigation.canGoNext.value).toBe(true)
    expect(navigation.canGoPrevious.value).toBe(true)

    navigation.selectNextItem()
    expect(selectItem).toHaveBeenCalledTimes(1)
    expect(selectItem).toHaveBeenCalledWith('a')

    navigation.selectPreviousItem()
    expect(selectItem).toHaveBeenCalledTimes(2)
    expect(selectItem).toHaveBeenLastCalledWith('c')
  })

  test('disables forward navigation when only one item exists', () => {
    const filteredViewItems = ref([{ _uid: 'a' }])
    const selectedViewItem = ref({ _uid: 'a' })
    const selectItem = vi.fn()

    const navigation = useSelectionNavigation({ filteredViewItems, selectedViewItem, selectItem })

    expect(navigation.canGoNext.value).toBe(false)
  })
})
