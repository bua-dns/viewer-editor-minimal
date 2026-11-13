<script setup>
// Configuration tab, sub-tab of one secondary collection (layout v2): its field configuration,
// written into the collection's own attribute of the viewer settings.
import { computed, ref } from 'vue'
import { useAppConfigStore } from '../stores/useAppConfigStore'
import { useAuthStore } from '../stores/useAuthStore'
import { useConnectionProfileStore } from '../stores/useConnectionProfileStore'
import { useOnlineModeStore } from '../stores/useOnlineModeStore'
import { useRemoteFieldModel } from '../composables/useRemoteFieldModel'
import UserConfigPanel from './UserConfigPanel.vue'

const props = defineProps({
  // A section of useSecondaryItems: { id, scope, settings, items }
  section: { type: Object, required: true },
  // useSecondaryItems() wrapped in reactive(), for `applyCollectionConfig`.
  linked: { type: Object, required: true },
})

const { t } = useAppConfigStore()
const { appMode } = useOnlineModeStore()
const { isAuthenticated, token } = useAuthStore()
const { connectionProfile } = useConnectionProfileStore()

const { fieldModel, reload } = useRemoteFieldModel({
  appMode,
  isAuthenticated,
  connectionProfile,
  token,
  onlineSettings: computed(() => props.section.settings),
  isNeeded: () => true,
})

const dataFieldKeys = computed(() => {
  const keys = new Set()
  props.section.items.forEach((item) => Object.keys(item).forEach((key) => keys.add(key)))
  return Array.from(keys)
})

const applyError = ref('')

async function onApply() {
  applyError.value = ''
  const result = await props.linked.applyCollectionConfig(props.section)
  if (!result.ok) applyError.value = result.error
}
</script>

<template>
  <div class="secondary-collection-config">
    <p class="secondary-collection-config-hint">
      {{ t('secondaryConfigHint', 'This configuration belongs to the collection and applies in every deployment that shows it.') }}
    </p>
    <p v-if="applyError" class="error">{{ applyError }}</p>
    <UserConfigPanel :key="section.scope" :config-scope="section.scope" :show-list-options="false"
      :has-data="section.items.length > 0" :allow-without-data="true" :force-open="true"
      :data-field-keys="dataFieldKeys" :remote-field-model="fieldModel"
      @apply="onApply" @reload-remote-field-model="reload" />
  </div>
</template>

<style scoped lang="scss">
.secondary-collection-config-hint {
  margin: 0 0 var(--ve-space-2);
  color: var(--ve-color-text-muted);
}
</style>
