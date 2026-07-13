<script setup>
import { computed } from 'vue'
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
      :prefill-value="prefillValue"
      :prefill-context="prefillContext"
      :placeholder="placeholder"
      @select="onSelectEntity"
    />

    <ul class="selected-entities" v-if="selectedEntities.length">
      <li v-for="entity in selectedEntities" :key="entity.id" class="selected-entity-item">
        <div class="selected-entity-main">
          <strong>{{ entity.label }}</strong>
          <span>{{ entity.id }}</span>
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
        <button type="button" @click="removeEntity(entity.id)">Remove</button>
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
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.5rem;
  padding: 0.4rem 0.5rem;
  border: 1px solid var(--ve-color-border);
  border-radius: 8px;
  background: var(--color-surface);
}

.selected-entity-main {
  display: grid;
  gap: 0.12rem;
}

.selected-entity-main span {
  color: var(--ve-color-text-muted);
  font-family: var(--ve-font-family-mono);
  font-size: 0.82rem;
}

.selected-entity-main small {
  color: var(--ve-color-text-muted);
  font-size: 0.8rem;
}

.selected-entity-meta--mono {
  font-family: var(--ve-font-family-mono);
}
</style>
