<script setup>
const props = defineProps({
  importFileName: {
    type: String,
    default: '',
  },
  searchQuery: {
    type: String,
    default: '',
  },
  isDirty: {
    type: Boolean,
    default: false,
  },
  noFileLoadedLabel: {
    type: String,
    required: true,
  },
  searchLabel: {
    type: String,
    required: true,
  },
  searchPlaceholder: {
    type: String,
    required: true,
  },
  unsavedChangesLabel: {
    type: String,
    required: true,
  },
})

const emit = defineEmits(['update:searchQuery'])

function onSearchInput(event) {
  emit('update:searchQuery', event.target.value)
}
</script>

<template>
  <section class="toolbar-panel">
    <div>
      <p v-if="!props.importFileName" class="meta">{{ props.noFileLoadedLabel }}</p>
    </div>
    <label v-if="props.importFileName" class="search-wrap">
      <span>{{ props.searchLabel }}</span>
      <input :value="props.searchQuery" type="search" :placeholder="props.searchPlaceholder" @input="onSearchInput" />
    </label>
    <p v-if="props.isDirty" class="dirty">{{ props.unsavedChangesLabel }}</p>
  </section>
</template>
