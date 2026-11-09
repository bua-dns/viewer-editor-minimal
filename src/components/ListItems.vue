<script setup>
// Renders a list of view items as scan cards (when the data has a scan field) or as compact rows.
// Used by ListPanel for the flat list, the hierarchy groups and the search results.
import { isCreatedItem } from '../composables/createdItems'
import { hasNonEmptyValue } from '../composables/valueChecks'

const props = defineProps({
  items: {
    type: Array,
    required: true,
  },
  rawItems: {
    type: Array,
    required: true,
  },
  asCards: {
    type: Boolean,
    default: true,
  },
  selectedViewItem: {
    type: Object,
    default: null,
  },
  hasData: {
    type: Boolean,
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
  scanPreviewAlt: {
    type: String,
    required: true,
  },
  scanUnavailableLabel: {
    type: String,
    required: true,
  },
  newItemFallbackLabel: {
    type: String,
    default: '',
  },
  looksLikeImageUrl: {
    type: Function,
    required: true,
  },
  hasListImageFailed: {
    type: Function,
    required: true,
  },
  // Optional: a short text shown with each item, e.g. its category in the search results.
  resolveItemLocation: {
    type: Function,
    default: null,
  },
  listClass: {
    type: String,
    default: '',
  },
})

const emit = defineEmits(['select-item', 'list-image-failed', 'toggle-suspend-editing'])

function onSelectItem(uid) {
  emit('select-item', uid)
}

function onListImageFailed(uid) {
  emit('list-image-failed', uid)
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

function resolveConfiguredCaption(item) {
  const key = props.itemCaptionFieldKey
  if (!key || !item) return ''
  if (!Object.prototype.hasOwnProperty.call(item, key)) return ''
  return String(item[key] ?? '').trim()
}

function isNewItem(item) {
  return item?.__onlineMeta?.isDraft === true || isCreatedItem(item)
}

function resolveItemCaption(item) {
  const configuredCaption = resolveConfiguredCaption(item)
  if (configuredCaption) return configuredCaption
  const inventoryNumber = String(item?.inventory_number ?? '').trim()
  if (inventoryNumber) return inventoryNumber
  if (isNewItem(item) && props.newItemFallbackLabel) return props.newItemFallbackLabel
  return ''
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

function isSelected(item) {
  return Boolean(props.selectedViewItem && props.selectedViewItem._uid === item._uid)
}

function rawItemOf(item) {
  return props.rawItems[item._index]
}

function itemLocation(item) {
  if (typeof props.resolveItemLocation !== 'function') return ''
  return props.resolveItemLocation(rawItemOf(item))
}

function showsScan(item) {
  return props.looksLikeImageUrl(rawItemOf(item)?.scan) && !props.hasListImageFailed(item._uid)
}
</script>

<template>
  <ul v-if="props.asCards" class="card-grid" :class="props.listClass">
    <li v-for="item in props.items" :key="item._uid">
      <div
        class="item-card"
        role="button"
        tabindex="0"
        :class="{ active: isSelected(item) }"
        @click.stop="onSelectItem(item._uid)"
        @keydown="onItemKeydown($event, item._uid)"
      >
        <div class="card-media">
          <img
            v-if="showsScan(item)"
            :src="rawItemOf(item)?.scan"
            loading="lazy"
            decoding="async"
            :alt="props.scanPreviewAlt"
            @error="onListImageFailed(item._uid)"
          />
          <div v-else class="scan-fallback">{{ props.scanUnavailableLabel }}</div>
        </div>
        <span v-if="itemLocation(item)" class="item-location">{{ itemLocation(item) }}</span>
        <div class="card-caption">
          <span>{{ resolveItemCaption(rawItemOf(item)) || `#${item._index + 1}` }}</span>
          <span class="item-controls-right">
            <label v-if="!isEditedItem(rawItemOf(item))" class="suspend-editing-toggle" @click.stop>
              <span>{{ props.suspendEditingLabel }}</span>
              <input
                type="checkbox"
                :checked="isSuspendEditingItem(item)"
                :disabled="!props.hasData"
                @change="onSuspendEditingChange(item._uid, $event)"
              />
            </label>
            <span
              v-if="isEditedItem(rawItemOf(item))"
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

  <ul v-else class="item-list" :class="props.listClass">
    <li v-for="item in props.items" :key="item._uid">
      <div
        class="item-list-row"
        role="button"
        tabindex="0"
        :class="{ active: isSelected(item) }"
        @click.stop="onSelectItem(item._uid)"
        @keydown="onItemKeydown($event, item._uid)"
      >
        <span class="item-list-index">#{{ item._index + 1 }}</span>
        <span class="item-list-caption">
          {{ resolveItemCaption(rawItemOf(item)) || '-' }}
          <span v-if="itemLocation(item)" class="item-location">{{ itemLocation(item) }}</span>
        </span>
        <span class="item-controls-right">
          <label v-if="!isEditedItem(rawItemOf(item))" class="suspend-editing-toggle" @click.stop>
            <span>{{ props.suspendEditingLabel }}</span>
            <input
              type="checkbox"
              :checked="isSuspendEditingItem(item)"
              :disabled="!props.hasData"
              @change="onSuspendEditingChange(item._uid, $event)"
            />
          </label>
          <span
            v-if="isEditedItem(rawItemOf(item))"
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

<style scoped lang="scss">
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

.item-location {
  display: block;
  font-size: 0.8rem;
  font-weight: 400;
  color: var(--ve-color-text-soft);
}

.item-card.active .item-location,
.item-list-row.active .item-location {
  color: color-mix(in srgb, var(--ve-color-white) 85%, transparent);
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
  :global(.content-grid-selected) .card-grid {
    grid-template-columns: 1fr;
  }
}
</style>
