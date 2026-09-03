<script setup>
import { computed, ref } from 'vue'
import { useAppConfigStore } from '../stores/useAppConfigStore'
import { useReplacementsStore } from '../stores/useReplacementsStore'
import { useUserConfigStore } from '../stores/useUserConfigStore'
import { ALL_FIELDS_REPLACEMENT_KEY, collectReplaceableFieldKeys } from '../composables/replacementRules'

const emit = defineEmits(['apply-replacements'])

const { t } = useAppConfigStore()

const replaceValue = ref('')
const withValue = ref('')
const fieldValue = ref(ALL_FIELDS_REPLACEMENT_KEY)

const { addReplacement, applyStatus } = useReplacementsStore()
const { appliedUserConfigFields, userConfigFields } = useUserConfigStore()

const availableFields = computed(() => {
    const appliedKeys = collectReplaceableFieldKeys(appliedUserConfigFields.value)
    if (appliedKeys.length) return appliedKeys
    return collectReplaceableFieldKeys(userConfigFields.value)
})

const isApplying = computed(() => applyStatus.value === 'applying')
const canAddReplacement = computed(() => Boolean(replaceValue.value) && !isApplying.value)

function addToReplacementsList(replace, withText, field) {
    if (!canAddReplacement.value) return
    if (!addReplacement(field, replace, withText)) return

    replaceValue.value = ''
    withValue.value = ''
    fieldValue.value = ALL_FIELDS_REPLACEMENT_KEY
    emit('apply-replacements')
}
</script>

<template>
    <div class="replacements-section">
        <h3>{{ t('tabReplacements', 'Replacements') }}</h3>

        <div class="replacements-row">
            <div class="field-group">
                <label class="field-label">
                    {{ t('field_label', 'Feld') }}
                </label>
                <select v-model="fieldValue" class="replacement-input">
                    <option value="allFields">{{ t('allFields', 'alle Felder') }}</option>
                    <option v-for="field in availableFields" :key="field" :value="field">{{ field }}</option>
                </select>
            </div>
            <div class="field-group">
                <label class="field-label">
                    {{ t('replace_string', 'Ersetze') }}
                </label>
                <input v-model="replaceValue" type="text" class="replacement-input" />
            </div>

            <div class="field-group">
                <label class="field-label">
                    {{ t('replace_with', 'mit') }}
                </label>
                <input v-model="withValue" type="text" class="replacement-input" />
            </div>
        </div>

        <button type="button" class="add-button" :disabled="!canAddReplacement"
            @click="addToReplacementsList(replaceValue, withValue, fieldValue)">
            {{ t('add_to_replacements_list', 'zur Ersetzungsliste hinzufügen') }}
        </button>

        <p class="replacements-hint">
            {{ t('replacementsFieldTypeHint', 'Es werden nur Felder der Typen normal und Text berücksichtigt (ohne Read-only-Felder). Ersetzt wird literal, Teilzeichenketten, Groß-/Kleinschreibung beachtend.') }}
        </p>
    </div>
</template>

<style scoped lang="scss">
.replacements-section {
    padding: 1.5rem;
}

.replacements-row {
    display: flex;
    gap: 1.5rem;
    align-items: flex-start;
}

.field-group {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}

.field-label {
    font-size: 0.9rem;
    font-weight: 600;
}

.replacement-input {
    width: 100%;
    padding: 0.75rem 0.9rem;
    border: 1px solid #d0d7de;
    border-radius: 6px;
    font-size: 1rem;

    &:focus {
        outline: none;
        border-color: #1f7a8c;
    }
}

@media (max-width: 768px) {
    .replacements-row {
        flex-direction: column;
        gap: 1rem;
    }
}
.add-button {
  margin-top: 1.5rem;
  padding: 0.75rem 1.25rem;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.95rem;
  font-weight: 600;
}

.add-button:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.replacements-hint {
  margin: 0.75rem 0 0;
  font-size: 0.85rem;
  line-height: 1.4;
  color: var(--color-text-secondary);
}

.replacements-list {
  margin-top: 1.5rem;
  display: grid;
  gap: 1rem;
}

.replacement-field {
  margin: 0 0 0.5rem;
  font-size: 1rem;
}

.replacement-mappings {
  margin: 0;
  padding: 0.75rem 1rem;
  background: #f6f8fa;
  border-radius: 6px;
  font-size: 0.9rem;
  line-height: 1.4;
  white-space: pre-wrap;
}
</style>
