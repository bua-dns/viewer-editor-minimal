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
