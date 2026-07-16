<script setup>
import { computed, ref } from 'vue'
import WikidataAutosuggestInput from './WikidataAutosuggestInput.vue'
import { normalizeWikidataAutosuggestValue } from '../fields/wikidataAutosuggestField'

const props = defineProps({
  modelValue: { type: [Array, Object, String, Number, Boolean], default: () => [] },
  fieldId: { type: String, default: '' },
  placeholder: { type: String, default: '' },
  autosuggestConfig: { type: Object, default: null },
  prefillValue: { type: String, default: '' },
  prefillContext: { type: Object, default: null },
})

const emit = defineEmits(['update:modelValue'])

const selectedEntities = computed(() => normalizeWikidataAutosuggestValue(props.modelValue))
const expandedStatementDataByEntityId = ref({})

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function getStatementDataEntries(entity) {
  if (!isPlainObject(entity?.statementData)) {
    return []
  }

  return Object.entries(entity.statementData).filter(
    ([, statements]) => Array.isArray(statements) && statements.length > 0,
  )
}

function hasStatementData(entity) {
  return getStatementDataEntries(entity).length > 0
}

function isStatementDataExpanded(entityId) {
  return Boolean(expandedStatementDataByEntityId.value[entityId])
}

function toggleStatementData(entityId) {
  const nextValue = !isStatementDataExpanded(entityId)
  expandedStatementDataByEntityId.value = {
    ...expandedStatementDataByEntityId.value,
    [entityId]: nextValue,
  }
}

function getStatementDataText(entity) {
  return JSON.stringify(Object.fromEntries(getStatementDataEntries(entity)), null, 2)
}

function getPropertyIdsForRule(ruleName, defs) {
  if (!Array.isArray(defs)) {
    return []
  }

  if (ruleName === 'claimPresence') {
    return defs
      .map((definition) => {
        if (typeof definition === 'string') return definition
        if (typeof definition?.propertyId === 'string') return definition.propertyId
        if (typeof definition?.property === 'string') return definition.property
        return ''
      })
      .map((propertyId) => String(propertyId || '').trim())
      .filter(Boolean)
  }

  if (ruleName === 'claimValueMatch') {
    return defs
      .map((definition) => definition?.property)
      .map((propertyId) => String(propertyId || '').trim())
      .filter(Boolean)
  }

  return []
}

function getPropertyLabelForRule(ruleName, definition) {
  if (!definition || typeof definition !== 'object') {
    return ''
  }

  if (ruleName === 'claimPresence') {
    if (typeof definition.propertyLabel === 'string' && definition.propertyLabel.trim()) {
      return definition.propertyLabel.trim()
    }
    if (typeof definition.label === 'string' && definition.label.trim()) {
      return definition.label.trim()
    }
    return ''
  }

  if (ruleName === 'claimValueMatch') {
    if (typeof definition.label === 'string' && definition.label.trim()) {
      return definition.label.trim()
    }
    return ''
  }

  return ''
}

const prioritizationPropertyLabels = computed(() => {
  const prioritizeConfig = props.autosuggestConfig?.prioritize
  if (!prioritizeConfig || typeof prioritizeConfig !== 'object') {
    return {}
  }

  const labelsByPropertyId = {}

  for (const [ruleName, ruleConfig] of Object.entries(prioritizeConfig)) {
    if (!ruleConfig || typeof ruleConfig !== 'object' || !Array.isArray(ruleConfig.defs)) {
      continue
    }

    for (const definition of ruleConfig.defs) {
      const propertyIds = getPropertyIdsForRule(ruleName, [definition])
      if (!propertyIds.length) {
        continue
      }

      const label = getPropertyLabelForRule(ruleName, definition)
      if (!label) {
        continue
      }

      const propertyId = propertyIds[0]
      if (!labelsByPropertyId[propertyId]) {
        labelsByPropertyId[propertyId] = label
      }
    }
  }

  return labelsByPropertyId
})

function getPrioritizationValuesText(entity) {
  if (!entity?.prioritizationValues || typeof entity.prioritizationValues !== 'object') return ''

  return Object.entries(entity.prioritizationValues)
    .filter(([, values]) => Array.isArray(values) && values.length)
    .map(([propertyId, values]) => {
      const propertyLabel = prioritizationPropertyLabels.value[propertyId]
      const displayLabel = propertyLabel ? `${propertyLabel} (${propertyId})` : propertyId
      return `${displayLabel}: ${values.join(', ')}`
    })
    .join(' | ')
}

function getWikidataEntityUrl(entityId) {
  const normalizedId = String(entityId || '').trim()
  if (!normalizedId) return ''
  return `https://www.wikidata.org/wiki/${encodeURIComponent(normalizedId)}`
}

function onSelectEntity(entity) {
  const normalized = normalizeWikidataAutosuggestValue(entity)
  if (!normalized.length) return
  const [nextEntity] = normalized
  if (selectedEntities.value.some((entry) => entry.id === nextEntity.id)) return
  emit('update:modelValue', [...selectedEntities.value, nextEntity])
}

function removeEntity(idToRemove) {
  const nextValue = selectedEntities.value.filter((entry) => entry.id !== idToRemove)
  emit('update:modelValue', nextValue)
}
</script>

<template>
  <div class="viewer-wikidata-field" :data-field-id="fieldId">
    <WikidataAutosuggestInput
      :config="autosuggestConfig"
      :selected-entities="selectedEntities"
      :prefill-value="prefillValue"
      :prefill-context="prefillContext"
      :placeholder="placeholder"
      @select="onSelectEntity"
    />

    <ul class="selected-entities" v-if="selectedEntities.length">
      <li v-for="entity in selectedEntities" :key="entity.id" class="selected-entity-item">
        <div class="selected-entity-row">
          <div class="selected-entity-main">
            <strong>{{ entity.label }}</strong>
            <a
              v-if="getWikidataEntityUrl(entity.id)"
              :href="getWikidataEntityUrl(entity.id)"
              target="_blank"
              rel="noopener noreferrer"
            >
              {{ entity.id }}
            </a>
            <span v-else>{{ entity.id }}</span>
            <small v-if="entity.description">{{ entity.description }}</small>
            <small v-if="entity.ranking" class="selected-entity-meta">
              Rank: {{ entity.ranking.score }}
            </small>
            <small
              v-if="getPrioritizationValuesText(entity)"
              class="selected-entity-meta selected-entity-meta--mono"
            >
              {{ getPrioritizationValuesText(entity) }}
            </small>
          </div>
          <div class="selected-entity-actions">
            <button v-if="hasStatementData(entity)" type="button" @click="toggleStatementData(entity.id)">
              {{ isStatementDataExpanded(entity.id) ? 'Hide statement data' : 'Show statement data' }}
            </button>
            <button type="button" @click="removeEntity(entity.id)">Remove</button>
          </div>
        </div>
        <pre
          v-if="hasStatementData(entity) && isStatementDataExpanded(entity.id)"
          class="selected-entity-statement-data"
        >{{ getStatementDataText(entity) }}</pre>
      </li>
    </ul>
  </div>
</template>

<style scoped lang="scss">
.viewer-wikidata-field {
  display: grid;
  gap: 0.5rem;
}

.selected-entities {
  margin: 0;
  padding: 0;
  list-style: none;
  display: grid;
  gap: 0.35rem;
}

.selected-entity-item {
  display: grid;
  gap: 0.45rem;
  padding: 0.4rem 0.5rem;
  border: 1px solid var(--ve-color-border);
  border-radius: 8px;
  background: var(--color-surface);
}

.selected-entity-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.5rem;
}

.selected-entity-actions {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  align-items: flex-end;
}

.selected-entity-main {
  display: grid;
  gap: 0.12rem;
}

.selected-entity-main span,
.selected-entity-main a {
  color: var(--ve-color-text-muted);
  font-family: var(--ve-font-family-mono);
  font-size: 0.82rem;
}

.selected-entity-main a {
  text-decoration: underline;
  text-underline-offset: 2px;
}

.selected-entity-main small {
  color: var(--ve-color-text-muted);
  font-size: 0.8rem;
}

.selected-entity-meta--mono {
  font-family: var(--ve-font-family-mono);
}

.selected-entity-statement-data {
  margin: 0;
  padding: 0.5rem;
  border-radius: 6px;
  border: 1px solid var(--color-border-soft);
  font-family: var(--ve-font-family-mono);
  font-size: 0.8rem;
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
