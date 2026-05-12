<script setup>
import { computed } from 'vue'
import infoMarkdownDe from '../assets/texts/info-de.md?raw'
import infoMarkdownEn from '../assets/texts/info-en.md?raw'
import MarkdownIt from 'markdown-it'
import hljs from 'highlight.js/lib/core'
import bash from 'highlight.js/lib/languages/bash'
import javascript from 'highlight.js/lib/languages/javascript'
import json from 'highlight.js/lib/languages/json'
import plaintext from 'highlight.js/lib/languages/plaintext'
import xml from 'highlight.js/lib/languages/xml'
import { useAppConfigStore } from '../stores/useAppConfigStore'

hljs.registerLanguage('bash', bash)
hljs.registerLanguage('shell', bash)
hljs.registerLanguage('sh', bash)
hljs.registerLanguage('js', javascript)
hljs.registerLanguage('javascript', javascript)
hljs.registerLanguage('json', json)
hljs.registerLanguage('text', plaintext)
hljs.registerLanguage('plaintext', plaintext)
hljs.registerLanguage('html', xml)
hljs.registerLanguage('xml', xml)

const markdown = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: true,
  highlight(str, lang) {
    if (lang && hljs.getLanguage(lang)) {
      try {
        return `<pre class="hljs"><code>${hljs.highlight(str, { language: lang }).value}</code></pre>`
      } catch {
        // Fall back to auto detection below.
      }
    }

    return `<pre class="hljs"><code>${hljs.highlightAuto(str).value}</code></pre>`
  },
})

const { language } = useAppConfigStore()

const infoMarkdown = computed(() => (language.value === 'en' ? infoMarkdownEn : infoMarkdownDe))
const renderedHtml = computed(() => markdown.render(infoMarkdown.value))
</script>

<template>
  <article class="info-panel" v-html="renderedHtml" />
</template>

<style scoped lang="scss">
.info-panel {
  background: var(--ve-color-surface-panel);
  border: 1px solid var(--ve-color-border-default);
  border-radius: 12px;
  padding: var(--ve-space-4);
}

:deep(h1),
:deep(h2),
:deep(h3),
:deep(h4) {
  margin: 0;
}

:deep(h1) {
  font-size: 1.75rem;
  line-height: 1.2;
}

:deep(h2) {
  font-size: 1.5rem;
  line-height: 1.25;
}

:deep(h3) {
  font-size: 1.25rem;
  line-height: 1.3;
}

:deep(h4) {
  font-size: 1.1rem;
  line-height: 1.35;
}

:deep(hr) {
  border: 0;
  border-top: 1px solid var(--ve-color-border-default);
}

:deep(p),
:deep(ul),
:deep(ol),
:deep(blockquote),
:deep(pre) {
  margin: 0;
}

:deep(ul),
:deep(ol) {
  padding-left: 1.2rem;
}

:deep(li + li),
:deep(p + p) {
  margin-top: var(--ve-space-2);
}

:deep(blockquote) {
  padding-left: var(--ve-space-3);
  border-left: 3px solid var(--ve-color-border-default);
  color: var(--ve-color-text-soft);
}

:deep(code) {
  background: var(--ve-color-surface-elevated);
  padding: 0.1rem 0.3rem;
  border-radius: 4px;
}

:deep(strong) {
  font-weight: 600;
}

:deep(pre code) {
  display: block;
  overflow-x: auto;
  background: transparent;
  padding: 0;
  border-radius: 0;
}

:deep(pre.hljs) {
  padding: var(--ve-space-3);
  border-radius: 10px;
  border: 1px solid var(--ve-color-border-default);
  background: var(--ve-color-surface-elevated);
  color: var(--ve-color-text-default);
  font-family: 'Courier New', Courier, monospace;
  font-size: 0.95rem;
  line-height: 1.5;
}

:deep(.hljs-keyword),
:deep(.hljs-selector-tag),
:deep(.hljs-literal),
:deep(.hljs-title),
:deep(.hljs-section),
:deep(.hljs-link) {
  color: #0b5fff;
}

:deep(.hljs-string),
:deep(.hljs-attr),
:deep(.hljs-template-tag),
:deep(.hljs-template-variable) {
  color: #b84d00;
}

:deep(.hljs-comment),
:deep(.hljs-quote) {
  color: #66768f;
}

:deep(.hljs-number),
:deep(.hljs-symbol),
:deep(.hljs-bullet),
:deep(.hljs-variable) {
  color: #007a63;
}

:deep(.hljs-built_in),
:deep(.hljs-type),
:deep(.hljs-class .hljs-title) {
  color: #6b3fd1;
}

:deep(* + h1),
:deep(* + h2),
:deep(* + h3),
:deep(* + h4),
:deep(* + p),
:deep(* + ul),
:deep(* + ol),
:deep(* + blockquote),
:deep(* + hr),
:deep(* + pre) {
  margin-top: var(--ve-space-3);
}
</style>
