<script setup>
import { computed } from 'vue'
import { useAppConfigStore } from '../stores/useAppConfigStore'
import ViewerWikidataField from './ViewerWikidataField.vue'

// One field editor (input, textarea, checkbox or Wikidata field) from a field registry binding.
// With a prefill `proposal` the empty field shows that text as a proposal: typing changes and saves
// it, the check button or Enter (Ctrl+Enter in a textarea) saves it unchanged, the x discards it.
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
    title: t('prefillProposalTitle', 'Suggestion from another field, not saved yet: accept it with the check mark or Enter, or type to change it.'),
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
  acceptProposal()
}

function acceptProposal() {
  emit('change', props.proposal)
}
</script>

<template>
  <div class="field-editor-control" :class="{ 'has-prefill-proposal': hasProposal }">
    <component :is="editorComponent" v-bind="editorProps" v-on="editorListeners" />
    <div v-if="hasProposal" class="prefill-actions">
      <button
        type="button"
        class="prefill-action-btn prefill-accept-btn"
        :title="t('prefillAcceptLabel', 'Accept suggestion')"
        :aria-label="t('prefillAcceptLabel', 'Accept suggestion')"
        @click="acceptProposal"
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
          class="feather feather-check"
          aria-hidden="true"
        >
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
      </button>
      <button
        type="button"
        class="prefill-action-btn"
        :title="t('prefillClearLabel', 'Discard suggestion')"
        :aria-label="t('prefillClearLabel', 'Discard suggestion')"
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
  padding-right: 3.8rem;
}

// A suggestion is not a value yet: grey italic text on a grey field, so it reads like a placeholder.
.field-editor-control :deep(.is-prefill-proposal) {
  color: #8a9099;
  font-style: italic;
  background: #f1f3f5;
}

.prefill-actions {
  position: absolute;
  top: 0.3rem;
  right: 0.35rem;
  display: inline-flex;
  gap: 0.15rem;
}

.prefill-action-btn {
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

.prefill-accept-btn {
  color: #2f7d4f;
}

.prefill-action-btn:hover,
.prefill-action-btn:focus-visible {
  background: color-mix(in srgb, var(--ve-color-text-muted) 15%, transparent);
  color: var(--ve-color-text-strong);
}
</style>
