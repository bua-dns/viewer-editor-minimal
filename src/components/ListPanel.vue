<script setup>
import { computed } from 'vue'
import ListItems from './ListItems.vue'

const props = defineProps({
  itemLabel: {
    type: String,
    required: true,
  },
  importFileName: {
    type: String,
    default: '',
  },
  resultCountLabel: {
    type: String,
    required: true,
  },
  searchQuery: {
    type: String,
    default: '',
  },
  searchLabel: {
    type: String,
    required: true,
  },
  searchPlaceholder: {
    type: String,
    required: true,
  },
  // Collection search state, `panelState` of useCollectionSearch.
  search: {
    type: Object,
    default: () => ({}),
  },
  // Labels for the collection search: scopeGlobal, submit, resultsTitle, back, running, droppedFields.
  searchLabels: {
    type: Object,
    default: () => ({}),
  },
  showEditedSortToggle: {
    type: Boolean,
    default: false,
  },
  editedItemsFirst: {
    type: Boolean,
    default: false,
  },
  editedSortToggleLabel: {
    type: String,
    default: '',
  },
  hasData: {
    type: Boolean,
    required: true,
  },
  filteredViewItems: {
    type: Array,
    required: true,
  },
  selectedViewItem: {
    type: Object,
    default: null,
  },
  rawItems: {
    type: Array,
    required: true,
  },
  suspendedItemIndices: {
    type: Array,
    default: () => [],
  },
  itemCaptionFieldKey: {
    type: String,
    default: '',
  },
  markAsEditedBasisField: {
    type: String,
    default: '',
  },
  editedItemIconLabel: {
    type: String,
    default: '',
  },
  suspendEditingLabel: {
    type: String,
    default: '',
  },
  hasScanField: {
    type: Boolean,
    default: true,
  },
  scanPreviewAlt: {
    type: String,
    required: true,
  },
  scanUnavailableLabel: {
    type: String,
    required: true,
  },
  listEmptyAfterUploadLabel: {
    type: String,
    required: true,
  },
  noSearchResultsLabel: {
    type: String,
    required: true,
  },
  looksLikeImageUrl: {
    type: Function,
    required: true,
  },
  hasListImageFailed: {
    type: Function,
    required: true,
  },
  renderHeader: {
    type: Boolean,
    default: true,
  },
  renderBody: {
    type: Boolean,
    default: true,
  },
  showCreateItemButton: {
    type: Boolean,
    default: false,
  },
  createItemLabel: {
    type: String,
    default: '',
  },
  newItemFallbackLabel: {
    type: String,
    default: '',
  },
  hierarchyFields: {
    type: Array,
    default: () => [],
  },
  // While a level-1 group loads, the boxes are disabled (one group load at a time).
  hierarchyLoading: {
    type: Boolean,
    default: false,
  },
  hierarchyLevel1Options: {
    type: Array,
    default: () => [],
  },
  selectedHierarchyLevel1: {
    type: String,
    default: '',
  },
  hasSelectedHierarchyLevel1: {
    type: Boolean,
    default: false,
  },
  expandedHierarchyLevel2Values: {
    type: Array,
    default: () => [],
  },
  hierarchyUnassignedLabel: {
    type: String,
    default: 'Unassigned',
  },
  hierarchySelectLevel1Label: {
    type: String,
    default: '',
  },
  hierarchyCollapseAllLabel: {
    type: String,
    default: '',
  },
})

const emit = defineEmits([
  'clear-selection',
  'select-item',
  'list-image-failed',
  'toggle-suspend-editing',
  'update:search-query',
  'submit-search',
  'update:search-scope-override',
  'leave-search-results',
  'update:edited-items-first',
  'create-item',
  'hierarchy-select-level1',
  'hierarchy-toggle-level2',
  'hierarchy-collapse-all',
])

function onClearSelection() {
  emit('clear-selection')
}

function onSelectItem(uid) {
  emit('select-item', uid)
}

function onListImageFailed(uid) {
  emit('list-image-failed', uid)
}

function onSearchInput(event) {
  emit('update:search-query', event.target.value)
}

function onSearchKeydown(event) {
  if (event.key !== 'Enter') return
  event.preventDefault()
  emit('submit-search')
}

function onSearchScopeChange(event) {
  emit('update:search-scope-override', event.target.checked)
}

function onEditedSortToggleChange(event) {
  emit('update:edited-items-first', event.target.checked)
}

function normalizeHierarchyValue(value) {
  if (value == null) return ''
  return String(value).trim()
}

const normalizedHierarchyFields = computed(() => {
  const source = Array.isArray(props.hierarchyFields) ? props.hierarchyFields : []
  const normalized = source
    .map((entry) => String(entry || '').trim())
    .filter(Boolean)
  return Array.from(new Set(normalized))
})

const hierarchyLevel1FieldKey = computed(() => normalizedHierarchyFields.value[0] || '')
const hierarchyLevel2FieldKey = computed(() => normalizedHierarchyFields.value[1] || '')
const hasHierarchy = computed(() => Boolean(hierarchyLevel1FieldKey.value && hierarchyLevel2FieldKey.value))

const normalizedExpandedHierarchyLevel2 = computed(() =>
  new Set((Array.isArray(props.expandedHierarchyLevel2Values) ? props.expandedHierarchyLevel2Values : []).map((value) => normalizeHierarchyValue(value))),
)

const hierarchyLevel2Groups = computed(() => {
  if (!hasHierarchy.value) return []
  if (!props.hasSelectedHierarchyLevel1) return []

  const selectedLevel1Value = normalizeHierarchyValue(props.selectedHierarchyLevel1)
  const grouped = new Map()

  props.filteredViewItems.forEach((viewItem) => {
    const rawItem = props.rawItems[viewItem._index]
    const level1Value = normalizeHierarchyValue(rawItem?.[hierarchyLevel1FieldKey.value])
    if (level1Value !== selectedLevel1Value) return

    const level2Value = normalizeHierarchyValue(rawItem?.[hierarchyLevel2FieldKey.value])
    if (!grouped.has(level2Value)) {
      grouped.set(level2Value, [])
    }
    grouped.get(level2Value).push(viewItem)
  })

  const assigned = []
  let unassignedGroup = null
  grouped.forEach((items, value) => {
    const group = {
      value,
      label: value || props.hierarchyUnassignedLabel,
      items,
      isUnassigned: value.length === 0,
    }

    if (group.isUnassigned) {
      unassignedGroup = group
      return
    }
    assigned.push(group)
  })

  assigned.sort((left, right) => left.label.localeCompare(right.label))
  if (unassignedGroup) {
    assigned.push(unassignedGroup)
  }

  return assigned
})

function onSelectHierarchyLevel1(value) {
  emit('hierarchy-select-level1', normalizeHierarchyValue(value))
}

function onToggleHierarchyLevel2(value) {
  emit('hierarchy-toggle-level2', normalizeHierarchyValue(value))
}

function onCollapseAllHierarchyLevel2() {
  emit('hierarchy-collapse-all')
}

function isHierarchyLevel2Expanded(value) {
  const normalized = normalizeHierarchyValue(value)
  return normalizedExpandedHierarchyLevel2.value.has(normalized)
}

// Without a selection no box is active, also not the unassigned one (its value is '' as well).
function isSelectedHierarchyLevel1(value) {
  if (!props.hasSelectedHierarchyLevel1) return false
  return normalizeHierarchyValue(props.selectedHierarchyLevel1) === normalizeHierarchyValue(value)
}

function hasHierarchyCount(value) {
  return Number.isFinite(value)
}

// Where a search hit lives in the hierarchy, e.g. "Box A / Drawer 3".
function resolveItemLocation(rawItem) {
  const level1Value = normalizeHierarchyValue(rawItem?.[hierarchyLevel1FieldKey.value])
  const level2Value = normalizeHierarchyValue(rawItem?.[hierarchyLevel2FieldKey.value])
  return `${level1Value || props.hierarchyUnassignedLabel} / ${level2Value || props.hierarchyUnassignedLabel}`
}
</script>

<template>
  <section class="list-panel" :class="{ 'list-panel-head-only': props.renderHeader && !props.renderBody }" @click="props.renderBody ? onClearSelection() : null">
    <div v-if="props.renderHeader" class="list-panel-head">
      <h2>{{ props.itemLabel }} <span v-if="props.importFileName">({{ props.resultCountLabel }})</span></h2>
      <div class="list-panel-controls" @click.stop>
        <button
          v-if="props.showCreateItemButton"
          type="button"
          class="create-item-btn"
          @click="emit('create-item')"
        >
          {{ props.createItemLabel }}
        </button>
        <label class="search-wrap">
          <span>{{ props.searchLabel }}</span>
          <input
            :value="props.searchQuery"
            type="search"
            :placeholder="props.searchPlaceholder"
            :disabled="!props.search.enabled"
            @input="onSearchInput"
            @keydown="onSearchKeydown"
          />
        </label>
        <button
          v-if="props.search.needsSubmit"
          type="button"
          class="search-submit-btn"
          :disabled="props.search.running"
          @click="emit('submit-search')"
        >
          {{ props.searchLabels.submit }}
        </button>
        <label v-if="props.search.showScopeSwitch" class="search-scope-toggle">
          <input
            type="checkbox"
            :checked="props.search.scopeGlobal"
            :disabled="!props.search.canOverrideScope"
            @change="onSearchScopeChange"
          />
          <span>{{ props.searchLabels.scopeGlobal }}</span>
        </label>
        <label v-if="props.showEditedSortToggle" class="edited-sort-toggle">
          <input
            type="checkbox"
            :checked="props.editedItemsFirst"
            :disabled="!props.hasData"
            @change="onEditedSortToggleChange"
          />
          <span>{{ props.editedSortToggleLabel }}</span>
        </label>
      </div>
    </div>
    <template v-if="props.renderBody">
      <div v-if="hasHierarchy" class="hierarchy-wrap" @click.stop>
        <p v-if="props.hierarchyLevel1Options.length === 0" class="meta">{{ props.listEmptyAfterUploadLabel }}</p>

        <template v-else>
          <div class="hierarchy-level1-grid">
            <button
              v-for="entry in props.hierarchyLevel1Options"
              :key="`level1-${entry.value || '__unassigned__'}`"
              type="button"
              class="hierarchy-level1-box"
              :class="{ active: isSelectedHierarchyLevel1(entry.value) }"
              :disabled="props.hierarchyLoading"
              @click="onSelectHierarchyLevel1(entry.value)"
            >
              <span>{{ entry.value || props.hierarchyUnassignedLabel }}</span>
              <span v-if="hasHierarchyCount(entry.count)" class="hierarchy-level1-count">{{ entry.count }}</span>
            </button>
          </div>

          <p v-if="props.search.error" class="meta search-error">{{ props.search.error }}</p>

          <section v-if="props.search.showResults || props.search.running" class="search-results">
            <div class="search-results-head">
              <h3>
                {{ props.searchLabels.resultsTitle }}
                <span v-if="props.search.showResults" class="search-results-count">{{ props.filteredViewItems.length }}</span>
              </h3>
              <button
                v-if="props.search.showResults"
                type="button"
                class="hierarchy-collapse-btn"
                @click="emit('leave-search-results')"
              >
                {{ props.searchLabels.back }}
              </button>
            </div>
            <p v-if="props.search.running" class="meta">{{ props.searchLabels.running }}</p>
            <template v-else>
              <p v-if="props.search.droppedFieldKeys?.length" class="meta">
                {{ props.searchLabels.droppedFields }} {{ props.search.droppedFieldKeys.join(', ') }}
              </p>
              <p v-if="props.filteredViewItems.length === 0" class="meta">{{ props.noSearchResultsLabel }}</p>
              <ListItems
                v-else
                :items="props.filteredViewItems"
                :as-cards="props.hasScanField"
                :resolve-item-location="resolveItemLocation"
                :raw-items="props.rawItems"
                :selected-view-item="props.selectedViewItem"
                :has-data="props.hasData"
                :suspended-item-indices="props.suspendedItemIndices"
                :item-caption-field-key="props.itemCaptionFieldKey"
                :mark-as-edited-basis-field="props.markAsEditedBasisField"
                :edited-item-icon-label="props.editedItemIconLabel"
                :suspend-editing-label="props.suspendEditingLabel"
                :scan-preview-alt="props.scanPreviewAlt"
                :scan-unavailable-label="props.scanUnavailableLabel"
                :new-item-fallback-label="props.newItemFallbackLabel"
                :looks-like-image-url="props.looksLikeImageUrl"
                :has-list-image-failed="props.hasListImageFailed"
                @select-item="onSelectItem"
                @list-image-failed="onListImageFailed"
                @toggle-suspend-editing="emit('toggle-suspend-editing', $event)"
              />
            </template>
          </section>

          <template v-else>
            <p v-if="props.hasSelectedHierarchyLevel1 && hierarchyLevel2Groups.length === 0" class="meta">
              {{ props.noSearchResultsLabel }}
            </p>
            <p v-else-if="!props.hasSelectedHierarchyLevel1" class="meta">
              {{ props.hierarchySelectLevel1Label }}
            </p>

            <div v-if="hierarchyLevel2Groups.length" class="hierarchy-level2-actions">
              <button type="button" class="hierarchy-collapse-btn" @click="onCollapseAllHierarchyLevel2">
                {{ props.hierarchyCollapseAllLabel }}
              </button>
            </div>

            <section v-for="group in hierarchyLevel2Groups" :key="`level2-${group.value || '__unassigned__'}`" class="hierarchy-level2-group">
              <button
                type="button"
                class="hierarchy-level2-header"
                :class="{ expanded: isHierarchyLevel2Expanded(group.value) }"
                @click="onToggleHierarchyLevel2(group.value)"
              >
                <span>{{ group.label }}</span>
                <span class="hierarchy-level2-meta">{{ group.items.length }}</span>
              </button>

              <ListItems
                v-if="isHierarchyLevel2Expanded(group.value)"
                :items="group.items"
                :as-cards="props.hasScanField"
                list-class="hierarchy-group-items"
                :raw-items="props.rawItems"
                :selected-view-item="props.selectedViewItem"
                :has-data="props.hasData"
                :suspended-item-indices="props.suspendedItemIndices"
                :item-caption-field-key="props.itemCaptionFieldKey"
                :mark-as-edited-basis-field="props.markAsEditedBasisField"
                :edited-item-icon-label="props.editedItemIconLabel"
                :suspend-editing-label="props.suspendEditingLabel"
                :scan-preview-alt="props.scanPreviewAlt"
                :scan-unavailable-label="props.scanUnavailableLabel"
                :new-item-fallback-label="props.newItemFallbackLabel"
                :looks-like-image-url="props.looksLikeImageUrl"
                :has-list-image-failed="props.hasListImageFailed"
                @select-item="onSelectItem"
                @list-image-failed="onListImageFailed"
                @toggle-suspend-editing="emit('toggle-suspend-editing', $event)"
              />
            </section>
          </template>
        </template>
      </div>
      <p v-else-if="!props.hasData" class="meta">{{ props.listEmptyAfterUploadLabel }}</p>
      <p v-else-if="props.filteredViewItems.length === 0" class="meta">{{ props.noSearchResultsLabel }}</p>
      <ListItems
        v-else
        :items="props.filteredViewItems"
        :as-cards="props.hasScanField"
        :raw-items="props.rawItems"
        :selected-view-item="props.selectedViewItem"
        :has-data="props.hasData"
        :suspended-item-indices="props.suspendedItemIndices"
        :item-caption-field-key="props.itemCaptionFieldKey"
        :mark-as-edited-basis-field="props.markAsEditedBasisField"
        :edited-item-icon-label="props.editedItemIconLabel"
        :suspend-editing-label="props.suspendEditingLabel"
        :scan-preview-alt="props.scanPreviewAlt"
        :scan-unavailable-label="props.scanUnavailableLabel"
        :new-item-fallback-label="props.newItemFallbackLabel"
        :looks-like-image-url="props.looksLikeImageUrl"
        :has-list-image-failed="props.hasListImageFailed"
        @select-item="onSelectItem"
        @list-image-failed="onListImageFailed"
        @toggle-suspend-editing="emit('toggle-suspend-editing', $event)"
      />
    </template>
  </section>
</template>

<style scoped lang="scss">
.list-panel {
  grid-area: list;
}

.list-panel-head-only {
  padding: 0;
  border: 0;
  background: transparent;
}

.meta {
  margin: 0;
  color: var(--ve-color-text-soft);
}

.list-panel-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--ve-space-3);
}

.search-wrap {
  display: flex;
  align-items: center;
  gap: var(--ve-space-2);
}

.list-panel-controls {
  display: flex;
  align-items: center;
  gap: var(--ve-space-3);
}

.edited-sort-toggle {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  color: var(--ve-color-text-muted);
  font-size: 0.92rem;
}

.create-item-btn {
  background: var(--color-primary);
  color: var(--ve-color-white);
  border: 1px solid var(--color-primary);
  border-radius: 8px;
  padding: 0.4rem 0.75rem;
  font-weight: 600;
  white-space: nowrap;
  cursor: pointer;
}

.create-item-btn:hover:not(:disabled) {
  background: var(--color-primary-hover);
  border-color: var(--color-primary-hover);
}

.search-wrap input {
  min-width: 260px;
}

.search-submit-btn {
  border: 1px solid var(--color-primary);
  background: var(--ve-color-surface-card);
  color: var(--color-primary);
  border-radius: 8px;
  padding: 0.35rem 0.7rem;
  font-weight: 600;
  cursor: pointer;
}

.search-submit-btn:disabled {
  opacity: 0.6;
  cursor: default;
}

.search-scope-toggle {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  color: var(--ve-color-text-muted);
  font-size: 0.92rem;
  white-space: nowrap;
}

.search-results {
  display: grid;
  gap: var(--ve-space-3);
}

.search-results-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--ve-space-2);
}

.search-results-head h3 {
  margin: 0;
  font-size: 1rem;
}

.search-results-count {
  font-family: var(--ve-font-family-mono);
  font-size: 0.85rem;
  color: var(--ve-color-text-soft);
}

.search-error {
  color: var(--ve-color-danger);
}

.hierarchy-wrap {
  display: grid;
  gap: var(--ve-space-3);
}

.hierarchy-level1-grid {
  display: grid;
  gap: var(--ve-space-2);
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
}

.hierarchy-level1-box {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--ve-space-2);
  border: 1px solid var(--ve-color-border-default);
  border-radius: 8px;
  background: var(--ve-color-surface-card);
  color: var(--ve-color-text-default);
  padding: 0.55rem 0.7rem;
  cursor: pointer;
  text-align: left;
}

.hierarchy-level1-box:hover:not(:disabled) {
  background: color-mix(in srgb, var(--color-primary) 10%, var(--ve-color-surface-card));
  border-color: color-mix(in srgb, var(--color-primary) 32%, var(--ve-color-border-default));
}

.hierarchy-level1-box.active {
  background: var(--color-primary);
  border-color: var(--color-primary);
  color: var(--ve-color-white);
}

.hierarchy-level1-count {
  font-family: var(--ve-font-family-mono);
  font-size: 0.82rem;
  opacity: 0.9;
}

.hierarchy-level2-actions {
  display: flex;
  justify-content: flex-end;
}

.hierarchy-collapse-btn {
  border: 1px solid var(--ve-color-border-default);
  background: var(--ve-color-surface-card);
  color: var(--ve-color-text-default);
  border-radius: 8px;
  padding: 0.35rem 0.6rem;
  cursor: pointer;
}

.hierarchy-level2-group {
  display: grid;
  gap: var(--ve-space-2);
}

.hierarchy-level2-header {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--ve-space-2);
  border: 1px solid var(--ve-color-border-default);
  border-radius: 8px;
  background: color-mix(in srgb, var(--ve-color-surface-card) 88%, var(--color-primary) 12%);
  color: var(--ve-color-text-default);
  padding: 0.5rem 0.7rem;
  font-weight: 600;
  cursor: pointer;
  text-align: left;
}

.hierarchy-level2-header.expanded {
  border-color: color-mix(in srgb, var(--color-primary) 45%, var(--ve-color-border-default));
}

.hierarchy-level2-meta {
  font-family: var(--ve-font-family-mono);
  font-size: 0.82rem;
  color: var(--ve-color-text-soft);
}

.hierarchy-group-items {
  margin-top: 0;
}

@media (max-width: 768px) {
  .list-panel-head {
    flex-direction: column;
    align-items: flex-start;
  }

  .search-wrap {
    width: 100%;
    flex-direction: column;
    align-items: flex-start;
  }

  .hierarchy-level1-grid {
    grid-template-columns: 1fr;
  }

  .list-panel-controls {
    width: 100%;
    flex-direction: column;
    align-items: flex-start;
  }

  .search-wrap input {
    min-width: 0;
  }
}
</style>
