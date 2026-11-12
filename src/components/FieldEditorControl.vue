<script setup>
import { computed } from 'vue'
import { useAppConfigStore } from '../stores/useAppConfigStore'
import ViewerWikidataField from './ViewerWikidataField.vue'

// One field editor (input, textarea, checkbox or Wikidata field) from a field registry binding.
// With a prefill `proposal` the empty field shows that text as a proposal: typing changes and saves
// it, Enter (Ctrl+Enter in a textarea) saves it unchanged, the x button dismisses it.
const props = defineProps({
  binding: { type: Object, required: true },
  proposal: { type: String, default: '' },
})

const emit = defineEmits(['change', 'dismiss-proposal'])

const { t } = useAppConfigStore()

const hasProposal = computed(() => Boolean(props.proposal))

const editorComponent = computed(() =>
  props.binding.component === 'ViewerWikidataField' ? ViewerWikidataField : props.binding.component,
)

const editorProps = computed(() => {
  if (!hasProposal.value) return props.binding.componentProps
  return {
    ...props.binding.componentProps,
    value: props.proposal,
    class: 'is-prefill-proposal',
    title: t('prefillProposalTitle', 'Proposal from another field: Enter accepts it, typing changes it.'),
  }
})

const editorListeners = computed(() => {
  const listeners = { [props.binding.eventName]: onEditorEvent }
  if (hasProposal.value) listeners.keydown = onProposalKeydown
  return listeners
})

function onEditorEvent(event) {
  emit('change', props.binding.readEventValue(event))
}

function onProposalKeydown(event) {
  if (event.key !== 'Enter') return
  // A textarea needs Enter for line breaks, so there Ctrl+Enter (Cmd+Enter) accepts.
  const isTextarea = props.binding.component === 'textarea'
  const hasAcceptModifier = event.ctrlKey || event.metaKey
  if (isTextarea && !hasAcceptModifier) return
  event.preventDefault()
  emit('change', props.proposal)
}
</script>

<template>
  <div class="field-editor-control" :class="{ 'has-prefill-proposal': hasProposal }">
    <component :is="editorComponent" v-bind="editorProps" v-on="editorListeners" />
    <button
      v-if="hasProposal"
      type="button"
      class="prefill-clear-btn"
      :title="t('prefillClearLabel', 'Discard proposal')"
      :aria-label="t('prefillClearLabel', 'Discard proposal')"
      @click="emit('dismiss-proposal')"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        class="feather feather-x"
        aria-hidden="true"
      >
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    </button>
  </div>
</template>

<style scoped lang="scss">
.field-editor-control {
  position: relative;
  display: grid;
  min-width: 0;
}

.field-editor-control.has-prefill-proposal :deep(input),
.field-editor-control.has-prefill-proposal :deep(textarea) {
  padding-right: 2rem;
}

.field-editor-control :deep(.is-prefill-proposal) {
  color: var(--ve-color-text-muted);
  font-style: italic;
  border-style: dashed;
}

.prefill-clear-btn {
  position: absolute;
  top: 0.35rem;
  right: 0.35rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.5rem;
  height: 1.5rem;
  padding: 0;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--ve-color-text-muted);
  cursor: pointer;
}

.prefill-clear-btn:hover,
.prefill-clear-btn:focus-visible {
  background: color-mix(in srgb, var(--ve-color-text-muted) 15%, transparent);
  color: var(--ve-color-text-strong);
}
</style>
