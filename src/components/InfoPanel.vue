<script setup>
import infoMarkdown from '../assets/texts/info.md?raw'

const lines = infoMarkdown
  .split('\n')
  .map((line) => line.trim())
  .filter(Boolean)

const heading = lines.find((line) => line.startsWith('# '))?.replace('# ', '') || 'Info'
const steps = lines
  .filter((line) => /^\d+\.\s/.test(line))
  .map((line) => line.replace(/^\d+\.\s/, ''))
const note = lines.find((line) => line.startsWith('Hinweis:')) || ''
</script>

<template>
  <article class="info-panel">
    <h2>{{ heading }}</h2>
    <ol>
      <li v-for="step in steps" :key="step">{{ step }}</li>
    </ol>
    <p v-if="note" class="info-note">{{ note }}</p>
  </article>
</template>

<style scoped lang="scss">
.info-panel {
  background: var(--ve-color-surface-panel);
  border: 1px solid var(--ve-color-border-default);
  border-radius: 12px;
  padding: var(--ve-space-4);
}

h2 {
  margin: 0 0 var(--ve-space-3);
  font-size: 1.15rem;
}

ol {
  margin: 0;
  padding-left: 1.2rem;
}

li + li {
  margin-top: var(--ve-space-2);
}

.info-note {
  margin: var(--ve-space-3) 0 0;
  color: var(--ve-color-text-soft);
}
</style>
