<script setup>
import { useModalKeyboard } from '../composables/useModalKeyboard'

const props = defineProps({
  isOpen: {
    type: Boolean,
    required: true,
  },
  imageSrc: {
    type: String,
    default: '',
  },
  imageLoadFailed: {
    type: Boolean,
    default: false,
  },
  closeLabel: {
    type: String,
    required: true,
  },
  imageAlt: {
    type: String,
    required: true,
  },
  unavailableLabel: {
    type: String,
    required: true,
  },
})

const emit = defineEmits(['close', 'image-error'])

function onClose() {
  emit('close')
}

function onImageError() {
  emit('image-error')
}

useModalKeyboard({
  isOpen: () => props.isOpen,
  onClose,
})
</script>

<template>
  <div v-if="isOpen" class="lightbox" @click.self="onClose">
    <div class="lightbox-content">
      <div class="lightbox-actions">
        <button type="button" @click="onClose">{{ closeLabel }}</button>
      </div>
      <img v-if="!imageLoadFailed" :src="imageSrc" :alt="imageAlt" class="lightbox-image" @error="onImageError" />
      <div v-else class="scan-fallback scan-fallback-large">{{ unavailableLabel }}</div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.lightbox {
  position: fixed;
  inset: 0;
  z-index: 40;
  background: rgba(15, 23, 42, 0.82);
  display: grid;
  place-items: center;
  padding: var(--ve-space-4);
}

.lightbox-content {
  width: min(96vw, 1200px);
  max-height: 94vh;
  background: var(--ve-color-white);
  border-radius: 12px;
  border: 1px solid var(--ve-color-border-default);
  padding: var(--ve-space-3);
}

.lightbox-actions {
  display: flex;
  gap: var(--ve-space-2);
  justify-content: flex-end;
  margin-bottom: var(--ve-space-3);
}

.lightbox-image {
  width: 100%;
  max-height: calc(94vh - 90px);
  object-fit: contain;
  border-radius: 10px;
  background: #f1f5f9;
}

.scan-fallback {
  display: grid;
  place-items: center;
  min-height: 120px;
  border: 1px dashed var(--ve-color-border-soft);
  border-radius: 10px;
  color: var(--ve-color-text-soft);
  background: var(--ve-color-surface-base);
}

.scan-fallback-large {
  min-height: 60vh;
}
</style>
