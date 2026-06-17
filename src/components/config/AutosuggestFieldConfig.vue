<script setup>
import { computed, ref, watch } from 'vue'

const props = defineProps({
  modelValue: { type: Object, default: () => ({}) },
  t: { type: Function, required: true },
  collapseAdvancedToken: { type: Number, default: 0 },
})

const emit = defineEmits(['update:modelValue'])

function hasExistingAdvancedConfig(value) {
  if (!isPlainObject(value)) return false
  return Object.keys(value).length > 0
}

const isAdvancedOpen = ref(!hasExistingAdvancedConfig(props.modelValue))

watch(
  () => props.collapseAdvancedToken,
  () => {
    isAdvancedOpen.value = false
  },
)

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function cloneValue(value) {
  return JSON.parse(JSON.stringify(value))
}

function getConfig() {
  return isPlainObject(props.modelValue) ? props.modelValue : {}
}

function updateConfig(mutator) {
  const next = cloneValue(getConfig())
  mutator(next)
  emit('update:modelValue', next)
}

function getPrioritizeBlock(blockName) {
  const prioritize = getConfig().prioritize
  if (!isPlainObject(prioritize)) return {}
  const block = prioritize[blockName]
  return isPlainObject(block) ? block : {}
}

const searchLanguagesText = computed(() => {
  const languages = getConfig().searchLanguages
  if (!Array.isArray(languages)) return ''
  return languages.join(', ')
})

const resultLanguage = computed(() => String(getConfig().resultLanguage || ''))
const minChars = computed(() => {
  const value = getConfig().minChars
  return Number.isFinite(value) ? String(value) : ''
})
const limit = computed(() => {
  const value = getConfig().limit
  return Number.isFinite(value) ? String(value) : ''
})

const claimPresenceDefsText = computed(() => {
  const defs = getPrioritizeBlock('claimPresence').defs
  if (!Array.isArray(defs)) return ''
  return defs.join(', ')
})

const claimValueMatchDefs = computed(() => {
  const defs = getPrioritizeBlock('claimValueMatch').defs
  if (!Array.isArray(defs)) return []
  return defs.map((entry) => ({
    property: typeof entry?.property === 'string' ? entry.property : '',
    value: typeof entry?.value === 'string' ? entry.value : '',
  }))
})

function setSearchLanguages(text) {
  updateConfig((next) => {
    const parsed = String(text || '')
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean)

    if (parsed.length) {
      next.searchLanguages = parsed
      return
    }

    delete next.searchLanguages
  })
}

function setResultLanguage(value) {
  updateConfig((next) => {
    const normalized = String(value || '').trim()
    if (normalized) {
      next.resultLanguage = normalized
      return
    }
    delete next.resultLanguage
  })
}

function setPositiveNumberKey(key, value) {
  updateConfig((next) => {
    const parsed = Number(value)
    if (Number.isFinite(parsed) && parsed > 0) {
      next[key] = Math.floor(parsed)
      return
    }
    delete next[key]
  })
}

function ensurePrioritizeBlock(next, blockName) {
  if (!isPlainObject(next.prioritize)) {
    next.prioritize = {}
  }

  if (!isPlainObject(next.prioritize[blockName])) {
    next.prioritize[blockName] = {}
  }

  return next.prioritize[blockName]
}

function setBlockWeight(blockName, value) {
  updateConfig((next) => {
    const block = ensurePrioritizeBlock(next, blockName)
    const parsed = Number(value)
    if (Number.isFinite(parsed) && parsed >= 0) {
      block.weight = parsed
      return
    }
    delete block.weight
  })
}

function setBlockFlag(blockName, flagName, checked) {
  updateConfig((next) => {
    const block = ensurePrioritizeBlock(next, blockName)
    block[flagName] = Boolean(checked)
  })
}

function setClaimPresenceDefs(text) {
  updateConfig((next) => {
    const block = ensurePrioritizeBlock(next, 'claimPresence')
    const defs = String(text || '')
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean)

    if (defs.length) {
      block.defs = defs
      return
    }

    delete block.defs
  })
}

function addClaimValueMatchDef() {
  updateConfig((next) => {
    const block = ensurePrioritizeBlock(next, 'claimValueMatch')
    const defs = Array.isArray(block.defs) ? block.defs : []
    block.defs = [...defs, { property: '', value: '' }]
  })
}

function removeClaimValueMatchDef(index) {
  updateConfig((next) => {
    const block = ensurePrioritizeBlock(next, 'claimValueMatch')
    const defs = Array.isArray(block.defs) ? [...block.defs] : []
    defs.splice(index, 1)
    if (defs.length) {
      block.defs = defs
      return
    }
    delete block.defs
  })
}

function setClaimValueMatchDef(index, key, value) {
  updateConfig((next) => {
    const block = ensurePrioritizeBlock(next, 'claimValueMatch')
    const defs = Array.isArray(block.defs) ? [...block.defs] : []

    while (defs.length <= index) {
      defs.push({ property: '', value: '' })
    }

    const entry = isPlainObject(defs[index]) ? { ...defs[index] } : { property: '', value: '' }
    entry[key] = String(value || '')
    defs[index] = entry
    block.defs = defs
  })
}

function toggleAdvancedConfig() {
  isAdvancedOpen.value = !isAdvancedOpen.value
}
</script>

<template>
  <div class="autosuggest-config-box">
    <button type="button" class="autosuggest-header-row" @click="toggleAdvancedConfig">
      <strong class="autosuggest-config-title">{{ t('autosuggestOptions', 'Options') }}</strong>
      <span class="autosuggest-options-toggle">
        {{ isAdvancedOpen ? t('autosuggestOptions', 'Options') : t('autosuggestShowOptions', 'Show options') }}
        <span aria-hidden="true">{{ isAdvancedOpen ? '▴' : '▾' }}</span>
      </span>
    </button>

    <div v-show="isAdvancedOpen" class="autosuggest-options-content">
      <div class="autosuggest-grid">
        <label>{{ t('autosuggestSearchLanguages', 'Search languages') }}</label>
        <input
          :value="searchLanguagesText"
          type="text"
          :placeholder="t('autosuggestSearchLanguagesPlaceholder', 'de, en')"
          @input="setSearchLanguages($event.target.value)"
        />

        <label>{{ t('autosuggestResultLanguage', 'Result language') }}</label>
        <input
          :value="resultLanguage"
          type="text"
          :placeholder="t('autosuggestResultLanguagePlaceholder', 'de')"
          @input="setResultLanguage($event.target.value)"
        />

        <label>{{ t('autosuggestMinChars', 'Minimum characters') }}</label>
        <input :value="minChars" type="number" min="1" @input="setPositiveNumberKey('minChars', $event.target.value)" />

        <label>{{ t('autosuggestLimit', 'Result limit') }}</label>
        <input :value="limit" type="number" min="1" @input="setPositiveNumberKey('limit', $event.target.value)" />
      </div>

      <section class="autosuggest-priority-block">
        <h5>{{ t('autosuggestClaimPresenceTitle', 'claimPresence') }}</h5>
        <div class="autosuggest-grid">
          <label>{{ t('autosuggestWeight', 'Weight') }}</label>
          <input
            :value="getPrioritizeBlock('claimPresence').weight ?? ''"
            type="number"
            min="0"
            @input="setBlockWeight('claimPresence', $event.target.value)"
          />

          <label>{{ t('autosuggestDefs', 'Definitions') }}</label>
          <input
            :value="claimPresenceDefsText"
            type="text"
            :placeholder="t('autosuggestClaimPresenceDefsPlaceholder', 'P7715, P227')"
            @input="setClaimPresenceDefs($event.target.value)"
          />
        </div>

        <div class="autosuggest-flag-row">
          <label>
            <input
              type="checkbox"
              :checked="Boolean(getPrioritizeBlock('claimPresence').includeInEmitData)"
              @change="setBlockFlag('claimPresence', 'includeInEmitData', $event.target.checked)"
            />
            {{ t('autosuggestIncludeInEmitData', 'Include metadata in emitted selection') }}
          </label>
          <label>
            <input
              type="checkbox"
              :checked="Boolean(getPrioritizeBlock('claimPresence').showInSuggestion)"
              @change="setBlockFlag('claimPresence', 'showInSuggestion', $event.target.checked)"
            />
            {{ t('autosuggestShowInSuggestion', 'Show metadata in suggestions') }}
          </label>
        </div>
      </section>

      <section class="autosuggest-priority-block">
        <h5>{{ t('autosuggestClaimValueMatchTitle', 'claimValueMatch') }}</h5>
        <div class="autosuggest-grid">
          <label>{{ t('autosuggestWeight', 'Weight') }}</label>
          <input
            :value="getPrioritizeBlock('claimValueMatch').weight ?? ''"
            type="number"
            min="0"
            @input="setBlockWeight('claimValueMatch', $event.target.value)"
          />
        </div>

        <div class="autosuggest-flag-row">
          <label>
            <input
              type="checkbox"
              :checked="Boolean(getPrioritizeBlock('claimValueMatch').includeInEmitData)"
              @change="setBlockFlag('claimValueMatch', 'includeInEmitData', $event.target.checked)"
            />
            {{ t('autosuggestIncludeInEmitData', 'Include metadata in emitted selection') }}
          </label>
          <label>
            <input
              type="checkbox"
              :checked="Boolean(getPrioritizeBlock('claimValueMatch').showInSuggestion)"
              @change="setBlockFlag('claimValueMatch', 'showInSuggestion', $event.target.checked)"
            />
            {{ t('autosuggestShowInSuggestion', 'Show metadata in suggestions') }}
          </label>
        </div>

        <div class="claim-value-match-list">
          <div class="claim-value-match-row claim-value-match-head">
            <strong>{{ t('autosuggestProperty', 'Property') }}</strong>
            <strong>{{ t('autosuggestValue', 'Value') }}</strong>
            <strong></strong>
          </div>
          <div
            v-for="(entry, index) in claimValueMatchDefs"
            :key="`claim-value-match-${index}`"
            class="claim-value-match-row"
          >
            <input
              type="text"
              :value="entry.property"
              :placeholder="t('autosuggestPropertyPlaceholder', 'P31')"
              @input="setClaimValueMatchDef(index, 'property', $event.target.value)"
            />
            <input
              type="text"
              :value="entry.value"
              :placeholder="t('autosuggestValuePlaceholder', 'Q5')"
              @input="setClaimValueMatchDef(index, 'value', $event.target.value)"
            />
            <button type="button" class="remove-def-btn" @click="removeClaimValueMatchDef(index)">
              {{ t('removeFieldButton', 'Remove') }}
            </button>
          </div>
        </div>

        <button type="button" class="add-def-btn" @click="addClaimValueMatchDef">
          {{ t('autosuggestAddDefinition', 'Add definition') }}
        </button>
      </section>
    </div>
  </div>
</template>

<style scoped lang="scss">
.autosuggest-config-box {
  display: grid;
  gap: 0.6rem;
  background: transparent;
  padding: 0;
}

.autosuggest-header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--ve-space-2);
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  width: 100%;
  padding: 0.2rem 0.4rem;
  text-align: left;
  cursor: pointer;
  transition:
    background-color 140ms ease,
    border-color 140ms ease,
    color 140ms ease;
}

.autosuggest-header-row:hover {
  background: color-mix(in srgb, var(--ve-color-primary) 8%, transparent);
  border-color: color-mix(in srgb, var(--ve-color-primary) 25%, transparent);
}

.autosuggest-header-row:focus {
  outline: none;
}

.autosuggest-header-row:focus-visible {
  border-color: color-mix(in srgb, var(--ve-color-primary) 55%, transparent);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--ve-color-primary) 20%, transparent);
}

.autosuggest-config-title {
  color: var(--ve-color-text-strong);
}

.autosuggest-grid {
  display: grid;
  grid-template-columns: minmax(180px, 1fr) minmax(260px, 1.6fr);
  gap: 0.35rem var(--ve-space-2);
  align-items: center;
}

.autosuggest-priority-block {
  display: grid;
  gap: 0.4rem;
}

.autosuggest-options-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--ve-space-1);
  border: 0;
  background: transparent;
  color: var(--ve-color-text-muted);
  padding: 0;
  font-size: 0.9rem;
}

.autosuggest-options-content {
  display: grid;
  gap: 0.6rem;
}

.autosuggest-priority-block h5 {
  margin: 0;
  color: var(--ve-color-text-muted);
}

.autosuggest-flag-row {
  display: grid;
  gap: 0.3rem;
}

.claim-value-match-list {
  display: grid;
  gap: 0.35rem;
}

.claim-value-match-row {
  display: grid;
  grid-template-columns: minmax(120px, 1fr) minmax(120px, 1fr) auto;
  gap: var(--ve-space-2);
  align-items: center;
}

.claim-value-match-head {
  color: var(--ve-color-text-muted);
  font-size: 0.86rem;
}

.add-def-btn,
.remove-def-btn {
  background: var(--color-surface);
  color: var(--ve-color-text-muted);
  border: 1px solid var(--color-border);
}

@media (max-width: 768px) {
  .autosuggest-grid,
  .claim-value-match-row {
    grid-template-columns: 1fr;
  }
}
</style>
