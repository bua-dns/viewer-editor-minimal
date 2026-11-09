import { describe, expect, test, vi } from 'vitest'
import { computed, ref } from 'vue'
import { useCollectionSearch } from './useCollectionSearch'

function setup({ online = false, hasSelection = false, selected = 'A', query = '' } = {}) {
  const rawItems = ref([
    { box: 'A', label: 'oak one' },
    { box: 'B', label: 'oak two' },
    { box: 'A', label: 'pine' },
  ])
  const searchQuery = ref(query)
  // Stand-in for the local filter: every item whose label contains the query.
  const filteredViewItems = computed(() =>
    rawItems.value
      .map((item, index) => ({ _uid: `u${index}`, _index: index, item }))
      .filter(({ item }) => {
        const query = searchQuery.value.trim().toLowerCase()
        return query.length < 3 || item.label.includes(query)
      }),
  )
  const deps = {
    isOnlineSession: ref(online),
    hierarchyEnabled: ref(true),
    hasSelectedHierarchyLevel1: ref(hasSelection),
    selectedHierarchyLevel1: ref(selected),
    hierarchyLevel1FieldKey: ref('box'),
    searchQuery,
    filteredViewItems,
    rawItems,
    runOnlineSearch: vi.fn(async () => ({ ok: true, droppedFieldKeys: [] })),
    returnToCategories: vi.fn(async () => ({ ok: true })),
  }
  return { deps, search: useCollectionSearch(deps) }
}

const indicesOf = (viewItems) => viewItems.map((viewItem) => viewItem._index)

describe('useCollectionSearch scope', () => {
  test('is local inside a selected category and global without one', () => {
    const { deps, search } = setup({ hasSelection: true })
    expect(search.isGlobalScope.value).toBe(false)

    deps.hasSelectedHierarchyLevel1.value = false
    expect(search.isGlobalScope.value).toBe(true)
  })

  test('the switch makes the search global inside a category', async () => {
    const { search } = setup({ hasSelection: true })
    await search.setScopeOverride(true)
    expect(search.isGlobalScope.value).toBe(true)
  })

  test('without hierarchy there is no scope and no result view', () => {
    const { deps, search } = setup({ query: 'oak' })
    deps.hierarchyEnabled.value = false
    expect(search.isGlobalScope.value).toBe(false)
    expect(search.showSearchResults.value).toBe(false)
  })
})

describe('useCollectionSearch offline', () => {
  test('inside a category only its hits are navigable', () => {
    const { search } = setup({ hasSelection: true, query: 'oak' })
    expect(search.showSearchResults.value).toBe(false)
    expect(indicesOf(search.navigableViewItems.value)).toEqual([0])
  })

  test('with the global scope the hits of every category are shown live', async () => {
    const { deps, search } = setup({ hasSelection: true, query: 'oak' })
    await search.setScopeOverride(true)

    expect(search.showSearchResults.value).toBe(true)
    expect(indicesOf(search.navigableViewItems.value)).toEqual([0, 1])
    expect(deps.runOnlineSearch).not.toHaveBeenCalled()
  })

  test('a query under three characters shows no result view', () => {
    const { search } = setup({ query: 'oa' })
    expect(search.showSearchResults.value).toBe(false)
  })

  test('leaving the results clears the query', async () => {
    const { deps, search } = setup({ query: 'oak' })
    await search.leaveSearchResults()
    expect(deps.searchQuery.value).toBe('')
  })

  test('switching back to the local scope keeps the query', async () => {
    const { deps, search } = setup({ hasSelection: true, query: 'oak' })
    await search.setScopeOverride(true)
    await search.setScopeOverride(false)
    expect(deps.searchQuery.value).toBe('oak')
    expect(search.showSearchResults.value).toBe(false)
  })
})

describe('useCollectionSearch online', () => {
  test('runs the server search on submit and shows its results', async () => {
    const { deps, search } = setup({ online: true, query: '  Oak ' })
    expect(search.needsSubmit.value).toBe(true)
    expect(search.showSearchResults.value).toBe(false)

    await search.submitSearch()

    expect(deps.runOnlineSearch).toHaveBeenCalledWith('oak')
    expect(search.showSearchResults.value).toBe(true)
    expect(indicesOf(search.navigableViewItems.value)).toEqual([0, 1])
  })

  test('does not search on submit inside a category without the switch', async () => {
    const { deps, search } = setup({ online: true, hasSelection: true, query: 'oak' })
    await search.submitSearch()
    expect(deps.runOnlineSearch).not.toHaveBeenCalled()
  })

  test('keeps the category view when the search fails or is cancelled', async () => {
    const { deps, search } = setup({ online: true, query: 'oak' })
    deps.runOnlineSearch.mockResolvedValueOnce({ ok: false, error: 'Server down' })
    await search.submitSearch()
    expect(search.showSearchResults.value).toBe(false)
    expect(search.searchError.value).toBe('Server down')

    deps.runOnlineSearch.mockResolvedValueOnce({ ok: false })
    await search.submitSearch()
    expect(search.searchError.value).toBe('')
  })

  test('reports the fields the server could not search', async () => {
    const { deps, search } = setup({ online: true, query: 'oak' })
    deps.runOnlineSearch.mockResolvedValueOnce({ ok: true, droppedFieldKeys: ['notes'] })
    await search.submitSearch()
    expect(search.droppedFieldKeys.value).toEqual(['notes'])
  })

  test('submitting a cleared query returns to the categories', async () => {
    const { deps, search } = setup({ online: true, query: 'oak' })
    await search.submitSearch()
    deps.searchQuery.value = ''
    await search.submitSearch()

    expect(deps.returnToCategories).toHaveBeenCalledTimes(1)
    expect(search.showSearchResults.value).toBe(false)
  })

  test('stays in the results when returning is cancelled', async () => {
    const { deps, search } = setup({ online: true, query: 'oak' })
    await search.submitSearch()
    deps.returnToCategories.mockResolvedValueOnce({ ok: false })
    await search.leaveSearchResults()
    expect(search.showSearchResults.value).toBe(true)
  })

  test('switching the override off inside a category reloads that category', async () => {
    const { deps, search } = setup({ online: true, hasSelection: true, query: 'oak' })
    await search.setScopeOverride(true)
    await search.submitSearch()
    await search.setScopeOverride(false)

    expect(deps.returnToCategories).toHaveBeenCalledTimes(1)
    expect(search.showSearchResults.value).toBe(false)
  })
})
