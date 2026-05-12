<script setup>
import githubLogo from '../../assets/logos/Octicons-mark-github.svg'
import buaLogo from '../../assets/logos/dns-v1.svg'
</script>

<template>
  <div class="footer-identity">
    <a
      class="identity-link"
      href="https://github.com/bua-dns/viewer-editor-minimal/"
      target="_blank"
      rel="noopener noreferrer"
      aria-label="GitHub Repository"
    >
      <img class="identity-logo identity-logo-github" :src="githubLogo" alt="GitHub" />
    </a>

    <a
      class="identity-link"
      href="https://berlin-university-collections.de/"
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Berlin University Collections"
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
