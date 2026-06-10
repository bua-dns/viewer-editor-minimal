<script setup>
import { computed, ref } from 'vue'
import { useAppConfigStore } from '../stores/useAppConfigStore'
import { useReplacementsStore } from '../stores/useReplacementsStore'
import { useUserConfigStore } from '../stores/useUserConfigStore'

const { t } = useAppConfigStore()

const replaceValue = ref('')
const withValue = ref('')
const fieldValue = ref('allFields')

const { addReplacement } = useReplacementsStore()
const { appliedUserConfigFields, userConfigFields } = useUserConfigStore()

const availableFields = computed(() => {
    const appliedKeys = Object.keys(appliedUserConfigFields.value || {})
    if (appliedKeys.length) return appliedKeys
    return Object.keys(userConfigFields.value || {})
})

function addToReplacementsList(replace, withText, field) {
    addReplacement(field, replace, withText)
    replaceValue.value = ''
    withValue.value = ''
    fieldValue.value = 'allFields'
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

        <button type="button" class="add-button" @click="addToReplacementsList(replaceValue, withValue, fieldValue)">
            {{ t('add_to_replacements_list', 'zur Ersetzungsliste hinzufügen') }}
        </button>
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
