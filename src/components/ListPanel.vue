<script setup>
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
})

const emit = defineEmits([
  'clear-selection',
  'select-item',
  'list-image-failed',
  'update:search-query',
  'update:edited-items-first',
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

function resolveItemCaption(item) {
  const configuredCaptionKey = props.itemCaptionFieldKey
  if (configuredCaptionKey && item && Object.prototype.hasOwnProperty.call(item, configuredCaptionKey)) {
    const configuredCaption = String(item[configuredCaptionKey] ?? '').trim()
    if (configuredCaption) return configuredCaption
  }
  const inventoryNumber = String(item?.inventory_number ?? '').trim()
  if (inventoryNumber) return inventoryNumber
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
</script>

<template>
  <section class="list-panel" :class="{ 'list-panel-head-only': props.renderHeader && !props.renderBody }" @click="props.renderBody ? onClearSelection() : null">
    <div v-if="props.renderHeader" class="list-panel-head">
      <h2>{{ props.itemLabel }} <span v-if="props.importFileName">({{ props.resultCountLabel }})</span></h2>
      <div class="list-panel-controls" @click.stop>
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
      <p v-if="!props.hasData" class="meta">{{ props.listEmptyAfterUploadLabel }}</p>
      <p v-else-if="props.filteredViewItems.length === 0" class="meta">{{ props.noSearchResultsLabel }}</p>
      <ul v-else-if="props.hasScanField" class="card-grid">
      <li v-for="item in props.filteredViewItems" :key="item._uid">
        <button
          type="button"
          class="item-card"
          :class="{ active: props.selectedViewItem && props.selectedViewItem._uid === item._uid }"
          @click.stop="onSelectItem(item._uid)"
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
          </div>
        </button>
      </li>
      </ul>
      <ul v-else class="item-list">
        <li v-for="item in props.filteredViewItems" :key="item._uid">
          <button
            type="button"
            class="item-list-row"
            :class="{ active: props.selectedViewItem && props.selectedViewItem._uid === item._uid }"
            @click.stop="onSelectItem(item._uid)"
          >
            <span class="item-list-index">#{{ item._index + 1 }}</span>
            <span class="item-list-caption">{{ resolveItemCaption(props.rawItems[item._index]) || '-' }}</span>
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
          </button>
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

.search-wrap input {
  min-width: 260px;
}

.card-grid {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: var(--ve-space-3);
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
}

:global(.content-grid-selected) .card-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.item-card {
  width: 100%;
  display: grid;
  gap: var(--ve-space-2);
  text-align: left;
  background: var(--ve-color-surface-card);
  color: var(--ve-color-text-default);
  border: 1px solid var(--ve-color-border-default);
  padding: var(--ve-space-2);
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
