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
})

const emit = defineEmits(['clear-selection', 'select-item', 'list-image-failed'])

function onClearSelection() {
  emit('clear-selection')
}

function onSelectItem(uid) {
  emit('select-item', uid)
}

function onListImageFailed(uid) {
  emit('list-image-failed', uid)
}
</script>

<template>
  <section class="list-panel" @click="onClearSelection">
    <h2>{{ props.itemLabel }} <span v-if="props.importFileName">({{ props.resultCountLabel }})</span></h2>
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
  </section>
</template>

<style scoped lang="scss">
.list-panel {
  grid-area: list;
}

.meta {
  margin: 0;
  color: var(--ve-color-text-soft);
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
  :global(.content-grid-selected) .card-grid {
    grid-template-columns: 1fr;
  }
}
</style>
