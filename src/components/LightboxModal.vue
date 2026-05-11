<script setup>
defineProps({
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
