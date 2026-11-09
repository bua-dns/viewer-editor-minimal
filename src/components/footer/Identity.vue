<script setup>
import { computed } from 'vue'
import buaLogo from '../../assets/logos/dns-v1.svg'
import { useAppConfigStore } from '../../stores/useAppConfigStore'

const { t } = useAppConfigStore()

// Wording can come from the backend, so it is rendered as text, never as HTML. Line breaks are
// written as "\n"; a legacy "<br>" in an older backend override is turned into one as well.
const creditText = computed(() =>
  String(t('footerIdentityCredit', 'A tool by the Digital Network for Collections, Berlin University Alliance'))
    .replace(/<br\s*\/?>/gi, '\n'),
)
</script>

<template>
  <div class="footer-identity">
    <span class="identity-credit">{{ creditText }}</span>

    <a
      class="identity-link"
      href="https://berlin-university-collections.de/"
      target="_blank"
      rel="noopener noreferrer"
      :aria-label="t('footerBucAria', 'Berlin University Collections')"
    >
      <img class="identity-logo identity-logo-bua" :src="buaLogo" alt="Berlin University Collections" />
    </a>
  </div>
</template>

<style scoped lang="scss">
.footer-identity {
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.25rem;
}

.identity-credit {
  font-size: 1.125rem;
  line-height: 1.3;
  text-align: right;
  max-width: 28rem;
  white-space: pre-line;
}

.identity-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 1.25rem;
  border-radius: 10px;
}

.identity-logo {
  display: block;
}

.identity-logo-bua {
  width: 3.25rem;
  height: auto;
}
</style>
