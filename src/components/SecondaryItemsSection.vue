<script setup>
// The items of the secondary collections linked to the selected primary item (layout v2): one
// section per collection, one collapsible per item, closed by default, each with its own Save.
import { useAppConfigStore } from '../stores/useAppConfigStore'
import { useOnlineUpdatesStore } from '../stores/useOnlineUpdatesStore'
import { useUserConfigStore } from '../stores/useUserConfigStore'
import { describeLinkedItem, linkedItemKey, pickLanguageText } from '../composables/linkedItems'
import ItemFieldEditor from './ItemFieldEditor.vue'

const props = defineProps({
  // useSecondaryItems() wrapped in reactive(): `sections`, `savingKey` and the actions.
  linked: { type: Object, required: true },
  isEditableSimpleValue: { type: Function, required: true },
  canSave: { type: Boolean, default: false },
})

const { t, language } = useAppConfigStore()
const { hasPendingChangesForItem, saveStatus } = useOnlineUpdatesStore()

function sectionTitle(section) {
  return pickLanguageText(section.label, language.value) || section.id
}

function itemTitle(section, item) {
  return describeLinkedItem(item, useUserConfigStore(section.scope).appliedItemLabelField.value)
}

// Unique per linked item, so labels point to the right input next to the primary item's fields.
function fieldIdPrefix(item) {
  return `linked-${linkedItemKey(item).replace(/[^a-zA-Z0-9_-]/g, '-')}`
}

function isOpen(section, item) {
  return section.openKeys.includes(linkedItemKey(item))
}

function allOpen(section) {
  return section.items.length > 0 && section.openKeys.length === section.items.length
}

function isBusy() {
  return Boolean(props.linked.savingKey || props.linked.busyKey) || saveStatus.value === 'saving'
}

function isSaveDisabled(item) {
  return isBusy() || !hasPendingChangesForItem(item)
}

function onFieldChange(item, key, value, configuredType) {
  props.linked.changeField(item, key, value, configuredType)
}

function onAcceptCandidate(item, { targetField, candidateValue, targetConfiguredType }) {
  props.linked.changeField(item, targetField, candidateValue, targetConfiguredType)
}
</script>

<template>
  <section v-for="section in linked.sections" :key="section.id" class="secondary-items">
    <header class="secondary-items-head">
      <h3>
        {{ sectionTitle(section) }}
        <span v-if="section.status === 'ready'" class="secondary-items-count">({{ section.items.length }})</span>
      </h3>
      <button v-if="section.items.length > 1" type="button" class="secondary-items-toggle-all"
        @click="linked.setAllOpen(section, !allOpen(section))">
        {{ allOpen(section) ? t('secondaryItemsCollapseAll', 'Collapse all') : t('secondaryItemsExpandAll', 'Expand all') }}
      </button>
    </header>

    <p v-if="section.actionError" class="secondary-items-note secondary-items-error">{{ section.actionError }}</p>
    <p v-if="section.status === 'loading'" class="secondary-items-note">
      {{ t('secondaryItemsLoading', 'Loading linked items...') }}
    </p>
    <p v-else-if="section.error" class="secondary-items-note secondary-items-error">{{ section.error }}</p>
    <p v-else-if="section.status === 'ready' && !section.items.length" class="secondary-items-note">
      {{ t('secondaryItemsNone', 'No linked items.') }}
    </p>
    <p v-else-if="section.status === 'idle'" class="secondary-items-note">
      {{ t('secondaryItemsSaveFirst', 'Linked items are shown once the item is saved.') }}
    </p>

    <div v-for="item in section.items" :key="linkedItemKey(item)" class="secondary-item"
      :class="{ open: isOpen(section, item) }">
      <button type="button" class="secondary-item-head" :aria-expanded="isOpen(section, item)"
        @click="linked.toggleOpen(section, linkedItemKey(item))">
        <svg class="secondary-item-chevron" viewBox="0 0 24 24" aria-hidden="true">
          <polyline points="9 18 15 12 9 6" />
        </svg>
        <span class="secondary-item-title">{{ itemTitle(section, item) }}</span>
        <span v-if="hasPendingChangesForItem(item)" class="secondary-item-dirty"
          :title="t('secondaryItemUnsaved', 'Unsaved changes')">●</span>
      </button>

      <div v-if="isOpen(section, item)" class="secondary-item-body">
        <ItemFieldEditor :selected-raw-item="item" :config-scope="section.scope"
          :field-id-prefix="fieldIdPrefix(item)"
          :is-editable-simple-value="isEditableSimpleValue"
          @field-change="(key, value, type) => onFieldChange(item, key, value, type)"
          @accept-candidate="(payload) => onAcceptCandidate(item, payload)" />
        <div v-if="canSave" class="secondary-item-actions">
          <button type="button" class="secondary-item-remove" :disabled="isBusy()"
            :title="t('linkedItemUnlinkTitle', 'Removes the link to this item; the linked item is kept')"
            @click="linked.unlinkItem(section, item)">
            {{ t('linkedItemUnlink', 'Unlink') }}
          </button>
          <button type="button" class="secondary-item-remove secondary-item-delete" :disabled="isBusy()"
            :title="t('linkedItemDeleteTitle', 'Deletes the linked item for good')"
            @click="linked.deleteItem(section, item)">
            {{ t('linkedItemDelete', 'Delete') }}
          </button>
          <button type="button" class="sidebar-derive-button"
            :disabled="isSaveDisabled(item)"
            :title="t('sidebarSaveItemTitle', 'Saves only the changes of this item')"
            @click="linked.saveLinkedItem(item)">
            {{ linked.savingKey === linkedItemKey(item) ? t('onlineSavePending', 'Saving...') : t('sidebarSaveItem', 'Save item') }}
          </button>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped lang="scss">
.secondary-items {
  margin-top: var(--ve-space-3, 0.75rem);
  border-top: 1px solid var(--ve-color-border-default);
  padding-top: var(--ve-space-2);
}

.secondary-items-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--ve-space-2);

  h3 {
    margin: 0;
    font-size: 1rem;
  }
}

.secondary-items-count {
  color: var(--ve-color-text-muted);
  font-weight: normal;
}

.secondary-items-toggle-all {
  padding: 0.25rem 0.6rem;
  font-size: 0.85rem;
}

.secondary-items-note {
  margin: var(--ve-space-2) 0;
  color: var(--ve-color-text-muted);
}

.secondary-items-error {
  color: var(--ve-color-error);
}

.secondary-item {
  margin-top: var(--ve-space-2);
  border: 1px solid var(--ve-color-border-soft);
  border-radius: 6px;
  background: var(--ve-color-surface-card);
}

.secondary-item-head {
  display: flex;
  align-items: center;
  gap: var(--ve-space-2);
  width: 100%;
  padding: var(--ve-space-2);
  border: 0;
  background: transparent;
  color: var(--ve-color-text-default);
  text-align: left;
  cursor: pointer;
}

.secondary-item-head:hover,
.secondary-item-head:focus-visible {
  background: var(--ve-color-border-soft);
  color: var(--ve-color-text-default);
}

.secondary-item-chevron {
  width: 1rem;
  height: 1rem;
  flex: none;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
  transition: transform 0.15s ease;
}

.secondary-item.open .secondary-item-chevron {
  transform: rotate(90deg);
}

.secondary-item-title {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 600;
}

.secondary-item-dirty {
  color: var(--ve-color-secondary);
}

.secondary-item-body {
  padding: 0 var(--ve-space-2) var(--ve-space-2);
}

.secondary-item-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--ve-space-2);
  margin-top: var(--ve-space-2);
}

.secondary-item-remove {
  padding: 0.35rem 0.7rem;
  font-size: 0.88rem;
  border: 1px solid var(--ve-color-border-default);
  background: var(--ve-color-surface-panel);
  color: var(--ve-color-text-default);
}

.secondary-item-delete {
  border-color: var(--ve-color-danger);
  color: var(--ve-color-danger);
}

.secondary-item-remove:hover:not(:disabled),
.secondary-item-remove:focus-visible {
  background: var(--ve-color-border-soft);
  color: var(--ve-color-text-default);
}

.secondary-item-delete:hover:not(:disabled),
.secondary-item-delete:focus-visible {
  background: var(--ve-color-danger);
  color: var(--ve-color-white);
}
</style>
