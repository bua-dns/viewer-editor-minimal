<script setup>
import { computed, ref, watch } from 'vue'
import { useAppConfigStore } from '../stores/useAppConfigStore'
import { useOnlineSettingsStore } from '../stores/useOnlineSettingsStore'
import { pickLanguageText } from '../composables/linkedItems'
import UserConfigPanel from './UserConfigPanel.vue'
import DerivationRuleEditor from './DerivationRuleEditor.vue'
import SecondaryCollectionConfig from './SecondaryCollectionConfig.vue'

const props = defineProps({
  hasData: { type: Boolean, required: true },
  allowWithoutData: { type: Boolean, default: false },
  dataFieldKeys: { type: Array, default: () => [] },
  remoteFieldModel: { type: Object, default: null },
  noDataHint: { type: String, default: '' },
  // Loaded online collection when "derive items" is switched on and editable; empty hides the editor.
  derivationSourcePath: { type: String, default: '' },
  // Collection layout: useSecondaryItems() wrapped in reactive(); one sub-tab per secondary collection.
  linked: { type: Object, default: null },
})

const emit = defineEmits(['apply', 'reload-remote-field-model'])

const { t, language } = useAppConfigStore()
const { settings, primaryCollectionId } = useOnlineSettingsStore()

// '' = the primary collection, else the id of a secondary one.
const activeCollectionId = ref('')

const secondarySections = computed(() => (props.linked?.sections || []).filter((section) => section.settings))
const activeSection = computed(() => secondarySections.value.find((section) => section.id === activeCollectionId.value))
const primaryTitle = computed(
  () => pickLanguageText(settings.value?.label, language.value) || primaryCollectionId.value,
)

watch(secondarySections, (sections) => {
  if (!sections.some((section) => section.id === activeCollectionId.value)) activeCollectionId.value = ''
})

function sectionTitle(section) {
  return pickLanguageText(section.label, language.value) || section.id
}
</script>

<template>
  <section class="configuration-panel">
    <div v-if="secondarySections.length" class="configuration-collection-tabs" role="tablist"
      :aria-label="t('configCollectionTabsAria', 'Collections')">
      <button type="button" role="tab" :aria-selected="activeCollectionId === ''"
        :class="{ active: activeCollectionId === '' }" @click="activeCollectionId = ''">
        {{ primaryTitle }}
      </button>
      <button v-for="section in secondarySections" :key="section.id" type="button" role="tab"
        :aria-selected="activeCollectionId === section.id" :class="{ active: activeCollectionId === section.id }"
        @click="activeCollectionId = section.id">
        {{ sectionTitle(section) }}
      </button>
    </div>

    <SecondaryCollectionConfig v-if="activeSection" :key="activeSection.id" :section="activeSection" :linked="linked" />
    <template v-else>
      <UserConfigPanel
        :has-data="hasData"
        :allow-without-data="allowWithoutData"
        :data-field-keys="dataFieldKeys"
        :remote-field-model="remoteFieldModel"
        :no-data-hint="noDataHint"
        :force-open="true"
        @apply="emit('apply')"
        @reload-remote-field-model="emit('reload-remote-field-model')"
      />
      <DerivationRuleEditor
        v-if="derivationSourcePath"
        :source-path="derivationSourcePath"
        :source-field-model="remoteFieldModel"
      />
    </template>
  </section>
</template>

<style scoped lang="scss">
.configuration-panel {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1rem;
}

.configuration-collection-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: var(--ve-space-2);
  border-bottom: 1px solid var(--ve-color-border-default);
  padding-bottom: var(--ve-space-2);

  button {
    padding: 0.35rem 0.8rem;
    border: 1px solid var(--ve-color-border-default);
    border-radius: 999px;
    background: var(--ve-color-surface-panel);
    color: var(--ve-color-text-default);
    cursor: pointer;
  }

  button.active {
    border-color: var(--ve-color-primary);
    background: var(--ve-color-primary);
    color: var(--ve-color-white);
  }
}
</style>
