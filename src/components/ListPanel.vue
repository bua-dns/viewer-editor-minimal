<script setup>
import { computed } from 'vue'

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

function onEditedSortToggleChange(event) {
  emit('update:edited-items-first', event.target.checked)
}

function onSuspendEditingChange(uid, event) {
  emit('toggle-suspend-editing', { uid, checked: event.target.checked })
}

function onItemKeydown(event, uid) {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    onSelectItem(uid)
  }
}

function resolveItemCaption(item) {
  const configuredCaptionKey = props.itemCaptionFieldKey
  if (configuredCaptionKey && item && Object.prototype.hasOwnProperty.call(item, configuredCaptionKey)) {
    const configuredCaption = String(item[configuredCaptionKey] ?? '').trim()
    if (configuredCaption) return configuredCaption
  }
  const inventoryNumber = String(item?.inventory_number ?? '').trim()
  if (inventoryNumber) return inventoryNumber
  if (item?.__onlineMeta?.isDraft === true && props.newItemFallbackLabel) {
    return props.newItemFallbackLabel
  }
  return ''
}

function hasNonEmptyValue(value) {
  if (value == null) return false
  if (typeof value === 'string') return value.trim().length > 0
  if (Array.isArray(value)) return value.length > 0
  if (typeof value === 'object') return Object.keys(value).length > 0
  return true
}

function isEditedItem(item) {
  if (!props.markAsEditedBasisField || !item) return false
  return hasNonEmptyValue(item[props.markAsEditedBasisField])
}

function isSuspendEditingItem(item) {
  const itemIndex = item?._index
  if (!Number.isInteger(itemIndex)) return false
  return props.suspendedItemIndices.includes(itemIndex)
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

function hasHierarchyCount(value) {
  return Number.isFinite(value)
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
            :disabled="!props.hasData"
            @input="onSearchInput"
          />
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
              :class="{ active: normalizeHierarchyValue(props.selectedHierarchyLevel1) === normalizeHierarchyValue(entry.value) }"
              @click="onSelectHierarchyLevel1(entry.value)"
            >
              <span>{{ entry.value || props.hierarchyUnassignedLabel }}</span>
              <span v-if="hasHierarchyCount(entry.count)" class="hierarchy-level1-count">{{ entry.count }}</span>
            </button>
          </div>

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

            <ul v-if="isHierarchyLevel2Expanded(group.value) && props.hasScanField" class="card-grid hierarchy-group-items">
              <li v-for="item in group.items" :key="item._uid">
                <div
                  class="item-card"
                  role="button"
                  tabindex="0"
                  :class="{ active: props.selectedViewItem && props.selectedViewItem._uid === item._uid }"
                  @click.stop="onSelectItem(item._uid)"
                  @keydown="onItemKeydown($event, item._uid)"
                >
                  <div class="card-media">
                    <img
                      v-if="props.looksLikeImageUrl(props.rawItems[item._index]?.scan) && !props.hasListImageFailed(item._uid)"
                      :src="props.rawItems[item._index]?.scan"
                      :alt="props.scanPreviewAlt"
                      @error="onListImageFailed(item._uid)"
                    />
                    <div v-else class="scan-fallback">{{ props.scanUnavailableLabel }}</div>
                  </div>
                  <div class="card-caption">
                    <span>{{ resolveItemCaption(props.rawItems[item._index]) || `#${item._index + 1}` }}</span>
                    <span class="item-controls-right">
                      <label v-if="!isEditedItem(props.rawItems[item._index])" class="suspend-editing-toggle" @click.stop>
                        <span>{{ props.suspendEditingLabel }}</span>
                        <input
                          type="checkbox"
                          :checked="isSuspendEditingItem(item)"
                          :disabled="!props.hasData"
                          @change="onSuspendEditingChange(item._uid, $event)"
                        />
                      </label>
                      <span
                        v-if="isEditedItem(props.rawItems[item._index])"
                        class="edited-item-indicator"
                        role="img"
                        :aria-label="props.editedItemIconLabel"
                        :title="props.editedItemIconLabel"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none"
                          stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
                          class="feather feather-edit-3">
                          <path d="M12 20h9"></path>
                          <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
                        </svg>
                      </span>
                    </span>
                  </div>
                </div>
              </li>
            </ul>

            <ul v-else-if="isHierarchyLevel2Expanded(group.value)" class="item-list hierarchy-group-items">
              <li v-for="item in group.items" :key="item._uid">
                <div
                  class="item-list-row"
                  role="button"
                  tabindex="0"
                  :class="{ active: props.selectedViewItem && props.selectedViewItem._uid === item._uid }"
                  @click.stop="onSelectItem(item._uid)"
                  @keydown="onItemKeydown($event, item._uid)"
                >
                  <span class="item-list-index">#{{ item._index + 1 }}</span>
                  <span class="item-list-caption">{{ resolveItemCaption(props.rawItems[item._index]) || '-' }}</span>
                  <span class="item-controls-right">
                    <label v-if="!isEditedItem(props.rawItems[item._index])" class="suspend-editing-toggle" @click.stop>
                      <span>{{ props.suspendEditingLabel }}</span>
                      <input
                        type="checkbox"
                        :checked="isSuspendEditingItem(item)"
                        :disabled="!props.hasData"
                        @change="onSuspendEditingChange(item._uid, $event)"
                      />
                    </label>
                    <span
                      v-if="isEditedItem(props.rawItems[item._index])"
                      class="edited-item-indicator"
                      role="img"
                      :aria-label="props.editedItemIconLabel"
                      :title="props.editedItemIconLabel"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
                        class="feather feather-edit-3">
                        <path d="M12 20h9"></path>
                        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
                      </svg>
                    </span>
                  </span>
                </div>
              </li>
            </ul>
          </section>
        </template>
      </div>
      <p v-else-if="!props.hasData" class="meta">{{ props.listEmptyAfterUploadLabel }}</p>
      <p v-else-if="props.filteredViewItems.length === 0" class="meta">{{ props.noSearchResultsLabel }}</p>
      <ul v-else-if="props.hasScanField" class="card-grid">
        <li v-for="item in props.filteredViewItems" :key="item._uid">
          <div
            class="item-card"
            role="button"
            tabindex="0"
            :class="{ active: props.selectedViewItem && props.selectedViewItem._uid === item._uid }"
            @click.stop="onSelectItem(item._uid)"
            @keydown="onItemKeydown($event, item._uid)"
          >
            <div class="card-media">
              <img
                v-if="props.looksLikeImageUrl(props.rawItems[item._index]?.scan) && !props.hasListImageFailed(item._uid)"
                :src="props.rawItems[item._index]?.scan"
                :alt="props.scanPreviewAlt"
                @error="onListImageFailed(item._uid)"
              />
              <div v-else class="scan-fallback">{{ props.scanUnavailableLabel }}</div>
            </div>
            <div class="card-caption">
              <span>{{ resolveItemCaption(props.rawItems[item._index]) || `#${item._index + 1}` }}</span>
              <span class="item-controls-right">
                <label v-if="!isEditedItem(props.rawItems[item._index])" class="suspend-editing-toggle" @click.stop>
                  <span>{{ props.suspendEditingLabel }}</span>
                  <input
                    type="checkbox"
                    :checked="isSuspendEditingItem(item)"
                    :disabled="!props.hasData"
                    @change="onSuspendEditingChange(item._uid, $event)"
                  />
                </label>
                <span
                  v-if="isEditedItem(props.rawItems[item._index])"
                  class="edited-item-indicator"
                  role="img"
                  :aria-label="props.editedItemIconLabel"
                  :title="props.editedItemIconLabel"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
                    class="feather feather-edit-3">
                    <path d="M12 20h9"></path>
                    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
                  </svg>
                </span>
              </span>
            </div>
          </div>
        </li>
      </ul>
      <ul v-else class="item-list">
        <li v-for="item in props.filteredViewItems" :key="item._uid">
          <div
            class="item-list-row"
            role="button"
            tabindex="0"
            :class="{ active: props.selectedViewItem && props.selectedViewItem._uid === item._uid }"
            @click.stop="onSelectItem(item._uid)"
            @keydown="onItemKeydown($event, item._uid)"
          >
            <span class="item-list-index">#{{ item._index + 1 }}</span>
            <span class="item-list-caption">{{ resolveItemCaption(props.rawItems[item._index]) || '-' }}</span>
            <span class="item-controls-right">
              <label v-if="!isEditedItem(props.rawItems[item._index])" class="suspend-editing-toggle" @click.stop>
                <span>{{ props.suspendEditingLabel }}</span>
                <input
                  type="checkbox"
                  :checked="isSuspendEditingItem(item)"
                  :disabled="!props.hasData"
                  @change="onSuspendEditingChange(item._uid, $event)"
                />
              </label>
              <span
                v-if="isEditedItem(props.rawItems[item._index])"
                class="edited-item-indicator"
                role="img"
                :aria-label="props.editedItemIconLabel"
                :title="props.editedItemIconLabel"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
                  class="feather feather-edit-3">
                  <path d="M12 20h9"></path>
                  <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
                </svg>
              </span>
            </span>
          </div>
        </li>
      </ul>
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

.card-grid {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: var(--ve-space-3);
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
}

.suspend-editing-toggle {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  color: var(--ve-color-text-muted);
  font-size: 0.85rem;
}

.item-controls-right {
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--ve-space-2);
}

:global(.content-grid-selected) .card-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.item-card {
  width: 100%;
  display: grid;
  gap: var(--ve-space-2);
  text-align: left;
  cursor: pointer;
  background: var(--ve-color-surface-card);
  color: var(--ve-color-text-default);
  border: 1px solid var(--ve-color-border-default);
  padding: var(--ve-space-2);
}

.item-card:focus-visible,
.item-list-row:focus-visible {
  outline: 2px solid color-mix(in srgb, var(--color-primary) 55%, var(--ve-color-white));
  outline-offset: 2px;
}

.item-card:hover:not(:disabled) {
  background: color-mix(in srgb, var(--color-primary) 10%, var(--ve-color-surface-card));
  border-color: color-mix(in srgb, var(--color-primary) 35%, var(--ve-color-border-default));
}

.item-card.active {
  background: var(--color-primary);
  color: var(--ve-color-white);
  border-color: var(--color-primary);
}

.card-media {
  border-radius: 10px;
  overflow: hidden;
  min-height: 240px;
  background: var(--ve-color-surface-base);
  border: 1px solid var(--ve-color-border-soft);
  display: grid;
  place-items: center;
}

.card-media img {
  width: 100%;
  height: 240px;
  object-fit: contain;
  display: block;
}

.card-caption {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--ve-space-2);
  font-weight: 600;
  line-height: 1.3;
  padding: 0.15rem 0.1rem;
  word-break: break-word;
}

.scan-fallback {
  display: grid;
  place-items: center;
  min-height: 120px;
  border: 1px dashed var(--ve-color-border-soft);
  border-radius: 10px;
  color: var(--ve-color-text-soft);
  background: var(--ve-color-surface-base);
}

.item-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: var(--ve-space-2);
}

.item-list-row {
  width: 100%;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: var(--ve-space-2);
  align-items: center;
  text-align: left;
  cursor: pointer;
  background: var(--ve-color-surface-card);
  color: var(--ve-color-text-default);
  border: 1px solid var(--ve-color-border-default);
  border-radius: 8px;
  padding: 0.5rem 0.65rem;
}

.item-list-row:hover:not(:disabled) {
  background: color-mix(in srgb, var(--color-primary) 8%, var(--ve-color-surface-card));
  border-color: color-mix(in srgb, var(--color-primary) 28%, var(--ve-color-border-default));
}

.item-list-row.active {
  background: var(--color-primary);
  color: var(--ve-color-white);
  border-color: var(--color-primary);
}

.item-list-index {
  font-family: var(--ve-font-family-mono);
  font-size: 0.8rem;
  color: var(--ve-color-text-soft);
}

.item-list-row.active .item-list-index {
  color: color-mix(in srgb, var(--ve-color-white) 85%, transparent);
}

.item-list-caption {
  font-weight: 600;
  line-height: 1.3;
  word-break: break-word;
}

.edited-item-indicator {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--ve-color-text-soft);
}

.item-list-row.active .edited-item-indicator,
.item-card.active .edited-item-indicator {
  color: color-mix(in srgb, var(--ve-color-white) 90%, transparent);
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

  :global(.content-grid-selected) .card-grid {
    grid-template-columns: 1fr;
  }
}
</style>
