<script setup>
// Konfiguration tab: the derivation rule of the loaded collection (viewer-setting.mappings).
// Dropdowns come from the data models of the source and the target collection; structured
// fields (relation, media, component, JSON) are listed but cannot be mapped.
import { computed, onMounted, toRef } from 'vue'
import { useAppConfigStore } from '../stores/useAppConfigStore'
import { useDerivationRuleDraft } from '../composables/useDerivationRuleDraft'

const props = defineProps({
  sourcePath: { type: String, required: true },
  // { fields: [{ key, strapiType, isStructured }], status } of the loaded collection
  sourceFieldModel: { type: Object, default: null },
})

const { t } = useAppConfigStore()
const {
  draft,
  collectionTypes,
  targetModel,
  relationFieldOptions,
  errors,
  isDirty,
  canSave,
  saveStatus,
  lastSaveError,
  loadCollectionTypes,
  reloadTargetModel,
  addRow,
  removeRow,
  resetDraft,
  save,
} = useDerivationRuleDraft({ sourcePath: toRef(props, 'sourcePath') })

onMounted(loadCollectionTypes)

const NUMBER_TYPES = new Set(['integer', 'biginteger', 'decimal', 'float'])

const sourceFields = computed(() => props.sourceFieldModel?.fields || [])
const targetFields = computed(() => targetModel.value.fields)
const targetOptions = computed(() => collectionTypes.value.filter((entry) => entry.path !== draft.value.source))
const targetIsListed = computed(() => !draft.value.target || targetOptions.value.some((entry) => entry.path === draft.value.target))

function fieldOptionLabel(field) {
  return field.strapiType ? `${field.key} (${field.strapiType})` : field.key
}

function constantInputType(row) {
  const field = targetFields.value.find((entry) => entry.key === row.target)
  if (field?.strapiType === 'boolean') return 'checkbox'
  return NUMBER_TYPES.has(field?.strapiType) ? 'number' : 'text'
}

function onKindChange(row) {
  if (row.kind === 'constant') {
    row.value = constantInputType(row) === 'checkbox' ? false : ''
  }
}

const saveNote = computed(() => {
  if (saveStatus.value === 'saving') return t('deriveRuleSaving', 'Saving…')
  if (saveStatus.value === 'saved' && !isDirty.value) return t('deriveRuleSaved', 'Rule saved.')
  return ''
})
</script>

<template>
  <section class="derive-rule-editor">
    <div class="derive-rule-head">
      <div class="derive-rule-title">{{ t('deriveRuleTitle', 'Derive items') }}</div>
      <button type="button" :disabled="!isDirty || saveStatus === 'saving'" @click="resetDraft">
        {{ t('deriveRuleDiscard', 'Discard changes') }}
      </button>
      <button type="button" :disabled="!canSave" @click="save">
        {{ t('deriveRuleSave', 'Save rule') }}
      </button>
    </div>
    <p class="derive-rule-note">
      {{
        t(
          'deriveRuleIntro',
          'The button in the item sidebar creates a new item in the target collection from the selected item and links the two. The rule is saved for all users of this Strapi instance.',
        )
      }}
    </p>

    <div class="derive-rule-grid">
      <span>{{ t('deriveRuleSource', 'Source collection') }}</span>
      <code>{{ draft.source }}</code>

      <label for="derive-rule-target">{{ t('deriveRuleTarget', 'Target collection') }}</label>
      <div class="derive-rule-controls">
        <select v-if="targetOptions.length && targetIsListed" id="derive-rule-target" v-model="draft.target">
          <option value="">{{ t('deriveRuleChoose', 'Choose …') }}</option>
          <option v-for="entry in targetOptions" :key="entry.path" :value="entry.path">
            {{ entry.name }} ({{ entry.path }})
          </option>
        </select>
        <input v-else id="derive-rule-target" v-model.lazy.trim="draft.target" type="text" placeholder="/api/collection-items" />
        <button type="button" :disabled="!draft.target || targetModel.status === 'loading'" @click="reloadTargetModel">
          {{ t('remoteFieldModelReload', 'Reload data model') }}
        </button>
      </div>
      <p v-if="targetModel.status === 'error'" class="derive-rule-note error derive-rule-span">
        {{ targetModel.errorMessage }}
      </p>

      <label for="derive-rule-relation">{{ t('deriveRuleRelation', 'Relation field (target)') }}</label>
      <select id="derive-rule-relation" v-model="draft.relationField">
        <option value="">{{ t('deriveRuleChoose', 'Choose …') }}</option>
        <option v-if="draft.relationField && !relationFieldOptions.some((field) => field.key === draft.relationField)"
          :value="draft.relationField">{{ draft.relationField }}</option>
        <option v-for="field in relationFieldOptions" :key="field.key" :value="field.key">{{ fieldOptionLabel(field) }}</option>
      </select>

      <label for="derive-rule-label-de">{{ t('deriveRuleLabelDe', 'Button label (de)') }}</label>
      <input id="derive-rule-label-de" v-model="draft.labelDe" type="text" :placeholder="t('deriveItemButton', 'Derive item')" />

      <label for="derive-rule-label-en">{{ t('deriveRuleLabelEn', 'Button label (en)') }}</label>
      <input id="derive-rule-label-en" v-model="draft.labelEn" type="text" :placeholder="t('deriveItemButton', 'Derive item')" />
    </div>

    <table class="derive-rule-fields">
      <thead>
        <tr>
          <th scope="col">{{ t('deriveRuleTargetField', 'Target field') }}</th>
          <th scope="col">{{ t('deriveRuleKind', 'Value from') }}</th>
          <th scope="col">{{ t('deriveRuleSourceOrValue', 'Source field / value') }}</th>
          <th scope="col">{{ t('deriveRulePrefix', 'Prefix') }}</th>
          <th scope="col"><span class="visually-hidden">{{ t('deriveRuleRemove', 'Remove') }}</span></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in draft.rows" :key="row.key">
          <td>
            <select v-model="row.target" :aria-label="t('deriveRuleTargetField', 'Target field')">
              <option value="">{{ t('deriveRuleChoose', 'Choose …') }}</option>
              <option v-if="row.target && !targetFields.some((field) => field.key === row.target)" :value="row.target">
                {{ row.target }}
              </option>
              <option v-for="field in targetFields" :key="field.key" :value="field.key" :disabled="field.isStructured">
                {{ fieldOptionLabel(field) }}
              </option>
            </select>
          </td>
          <td>
            <select v-model="row.kind" :aria-label="t('deriveRuleKind', 'Value from')" @change="onKindChange(row)">
              <option value="copy">{{ t('deriveRuleKindCopy', 'Source field') }}</option>
              <option value="constant">{{ t('deriveRuleKindConstant', 'Fixed value') }}</option>
            </select>
          </td>
          <td>
            <select v-if="row.kind === 'copy'" v-model="row.from" :aria-label="t('deriveRuleSourceField', 'Source field')">
              <option value="">{{ t('deriveRuleChoose', 'Choose …') }}</option>
              <option v-if="row.from && !sourceFields.some((field) => field.key === row.from)" :value="row.from">
                {{ row.from }}
              </option>
              <option v-for="field in sourceFields" :key="field.key" :value="field.key" :disabled="field.isStructured">
                {{ fieldOptionLabel(field) }}
              </option>
            </select>
            <input v-else-if="constantInputType(row) === 'checkbox'" v-model="row.value" type="checkbox"
              :aria-label="t('deriveRuleValue', 'Fixed value')" />
            <input v-else-if="constantInputType(row) === 'number'" v-model.number="row.value" type="number"
              :aria-label="t('deriveRuleValue', 'Fixed value')" />
            <input v-else v-model="row.value" type="text" :aria-label="t('deriveRuleValue', 'Fixed value')" />
          </td>
          <td>
            <input v-if="row.kind === 'copy'" v-model="row.prefix" type="text" placeholder="item_"
              :aria-label="t('deriveRulePrefix', 'Prefix')" />
          </td>
          <td>
            <button type="button" :aria-label="t('deriveRuleRemove', 'Remove')" @click="removeRow(row.key)">×</button>
          </td>
        </tr>
      </tbody>
    </table>
    <div>
      <button type="button" @click="addRow">{{ t('deriveRuleAddRow', 'Add field') }}</button>
    </div>

    <ul v-if="draft.target || draft.rows.length" class="derive-rule-errors">
      <li v-for="error in errors" :key="error.key">{{ t(error.key, error.fallback) }}</li>
    </ul>
    <p v-if="saveStatus === 'error'" class="derive-rule-note error" role="alert">{{ lastSaveError }}</p>
    <p v-else-if="saveNote" class="derive-rule-note" role="status">{{ saveNote }}</p>
  </section>
</template>

<style scoped lang="scss">
.derive-rule-editor {
  display: grid;
  gap: var(--ve-space-3);
  padding-top: var(--ve-space-4);
  border-top: 1px solid var(--ve-color-border-default);
}

.derive-rule-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--ve-space-2);
}

.derive-rule-title {
  color: var(--ve-color-text-strong);
  font-weight: 700;
  font-size: 1.25rem;
  margin-right: auto;
}

.derive-rule-note {
  margin: 0;
  color: var(--ve-color-text-muted);

  &.error {
    color: var(--ve-color-danger);
    font-weight: 600;
  }
}

.derive-rule-grid {
  display: grid;
  grid-template-columns: minmax(160px, 1fr) minmax(240px, 2fr);
  gap: var(--ve-space-2);
  align-items: center;
}

.derive-rule-span {
  grid-column: 1 / -1;
}

.derive-rule-controls {
  display: flex;
  flex-wrap: wrap;
  gap: var(--ve-space-2);
  min-width: 0;

  select,
  input {
    flex: 1 1 220px;
    min-width: 0;
  }
}

.derive-rule-fields {
  width: 100%;
  border-collapse: collapse;

  th {
    text-align: left;
    font-weight: 600;
  }

  th,
  td {
    padding: 0.25rem 0.35rem 0.25rem 0;
    vertical-align: middle;
  }

  select,
  input[type='text'],
  input[type='number'] {
    width: 100%;
    min-width: 0;
  }
}

.derive-rule-errors {
  margin: 0;
  padding-left: 1.2rem;
  color: var(--ve-color-danger);
}

.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}

@media (max-width: 720px) {
  .derive-rule-grid {
    grid-template-columns: 1fr;
  }

  .derive-rule-fields {
    display: block;
    overflow-x: auto;
  }
}
</style>
