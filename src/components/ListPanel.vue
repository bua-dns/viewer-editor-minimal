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

const emit = defineEmits(['clear-selection', 'select-item', 'list-image-failed', 'update:search-query'])

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
</script>

<template>
  <section class="list-panel" :class="{ 'list-panel-head-only': props.renderHeader && !props.renderBody }" @click="props.renderBody ? onClearSelection() : null">
    <div v-if="props.renderHeader" class="list-panel-head">
      <h2>{{ props.itemLabel }} <span v-if="props.importFileName">({{ props.resultCountLabel }})</span></h2>
      <label class="search-wrap" @click.stop>
        <span>{{ props.searchLabel }}</span>
        <input
          :value="props.searchQuery"
          type="search"
          :placeholder="props.searchPlaceholder"
          :disabled="!props.hasData"
          @input="onSearchInput"
        />
      </label>
    </div>
    <template v-if="props.renderBody">
      <p v-if="!props.hasData" class="meta">{{ props.listEmptyAfterUploadLabel }}</p>
      <p v-else-if="props.filteredViewItems.length === 0" class="meta">{{ props.noSearchResultsLabel }}</p>
      <ul v-else class="card-grid">
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
            {{ props.rawItems[item._index]?.inventory_number || `#${item._index + 1}` }}
          </div>
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

  .search-wrap input {
    min-width: 0;
  }

  :global(.content-grid-selected) .card-grid {
    grid-template-columns: 1fr;
  }
}
</style>
