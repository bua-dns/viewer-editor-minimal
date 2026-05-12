<script setup>
import githubLogo from '../../assets/logos/Octicons-mark-github.svg'
import buaLogo from '../../assets/logos/dns-v1.svg'
import { useAppConfigStore } from '../../stores/useAppConfigStore'

const { t } = useAppConfigStore()
</script>

<template>
  <div class="footer-identity">
    <a
      class="identity-link"
      href="https://github.com/bua-dns/viewer-editor-minimal/"
      target="_blank"
      rel="noopener noreferrer"
      :aria-label="t('footerGithubAria', 'GitHub repository')"
    >
      <img class="identity-logo identity-logo-github" :src="githubLogo" alt="GitHub" />
    </a>

    <span class="identity-credit" v-html="t('footerIdentityCredit', 'A tool by the Digital Network for Collections, Berlin University Alliance')" />

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

.identity-logo-github {
  width: 2rem;
  height: 2rem;
}

.identity-logo-bua {
  width: 3.25rem;
  height: auto;
}
</style>
