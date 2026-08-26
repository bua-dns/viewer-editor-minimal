<script setup>
import { onBeforeUnmount, ref, watch } from 'vue'
import { useAppConfigStore } from '../stores/useAppConfigStore'
import { useAuthStore } from '../stores/useAuthStore'
import { useConnectionProfileStore } from '../stores/useConnectionProfileStore'
import { useOnlineModeStore } from '../stores/useOnlineModeStore'
import { useOnlineSettingsStore } from '../stores/useOnlineSettingsStore'
import { useOnlineItemsStore } from '../stores/useOnlineItemsStore'

const props = defineProps({
  hasPendingOnlineUpdates: { type: Boolean, default: false },
  pendingOnlineUpdateCount: { type: Number, default: 0 },
  saveStatus: { type: String, default: 'idle' },
  saveError: { type: String, default: '' },
})

const emit = defineEmits(['open-connection-tab', 'save-online-updates', 'clear-save-feedback'])

const identifier = ref('')
const password = ref('')
const showPassword = ref(false)
const loginError = ref('')
const isLoginModalOpen = ref(false)
let saveStatusTimeoutId = null

const { t } = useAppConfigStore()
const { appMode, onlineConfigOnly, isConnectionModeSwitchable, setAppMode, setOnlineConfigOnly } = useOnlineModeStore()
const { hasConnectionProfile, lastConnectionProfileLoadError } = useConnectionProfileStore()

function connectionProfileDebugMessage() {
  const details = lastConnectionProfileLoadError.value
  if (!details || typeof details !== 'object') return ''

  const reason = String(details.reason || '').trim()
  const profileUrl = String(details.profileUrl || '').trim()
  const attemptedUrls = Array.isArray(details.attemptedUrls)
    ? details.attemptedUrls.map((entry) => String(entry || '').trim()).filter(Boolean)
    : []

  const parts = []
  if (reason) parts.push(`reason=${reason}`)
  if (profileUrl) parts.push(`profileUrl=${profileUrl}`)
  if (attemptedUrls.length) parts.push(`attempted=${attemptedUrls.join(', ')}`)

  return parts.join(' | ')
}
const { authStatus, isAuthenticated, lastAuthError, login, logout } = useAuthStore()
const { settingsStatus, lastSettingsError } = useOnlineSettingsStore()
const { itemsStatus, lastItemsError } = useOnlineItemsStore()

function onModeChange(nextMode) {
  setAppMode(nextMode)
}

function onOnlineConfigOnlyChange(event) {
  setOnlineConfigOnly(event.target.checked)
}

async function onLogin() {
  loginError.value = ''
  const result = await login(identifier.value, password.value)
  if (!result.ok) {
    loginError.value = result.error || t('authLoginFailed', 'Login failed.')
    return
  }

  isLoginModalOpen.value = false
  identifier.value = ''
  password.value = ''
  showPassword.value = false
}

function onLogout() {
  logout()
}

function onSaveOnlineChanges() {
  emit('save-online-updates')
}

function openLoginModal() {
  loginError.value = ''
  isLoginModalOpen.value = true
}

function closeLoginModal() {
  isLoginModalOpen.value = false
  password.value = ''
  showPassword.value = false
  loginError.value = ''
}

watch(
  () => [appMode.value, isAuthenticated.value],
  ([nextMode, nextAuthenticated]) => {
    if (nextMode !== 'online' || nextAuthenticated) {
      closeLoginModal()
    }
  },
)

watch(
  () => props.saveStatus,
  (nextSaveStatus) => {
    if (saveStatusTimeoutId) {
      clearTimeout(saveStatusTimeoutId)
      saveStatusTimeoutId = null
    }
    if (nextSaveStatus !== 'success') return
    saveStatusTimeoutId = setTimeout(() => {
      emit('clear-save-feedback')
      saveStatusTimeoutId = null
    }, 1800)
  },
)

onBeforeUnmount(() => {
  if (saveStatusTimeoutId) {
    clearTimeout(saveStatusTimeoutId)
    saveStatusTimeoutId = null
  }
})
</script>

<template>
  <section class="online-access-panel">
    <div v-if="isConnectionModeSwitchable" class="mode-switch" :aria-label="t('appModeAria', 'Application mode')">
      <button type="button" class="mode-btn" :class="{ active: appMode === 'offline' }" @click="onModeChange('offline')">
        {{ t('appModeOffline', 'Offline') }}
      </button>
      <button type="button" class="mode-btn" :class="{ active: appMode === 'online' }" @click="onModeChange('online')">
        {{ t('appModeOnline', 'Online') }}
      </button>
    </div>

    <p v-if="appMode === 'offline'" class="auth-note status-neutral auth-note-inline">
      {{ t('appModeOfflineNote', 'Offline mode active. Local JSON/CSV workflow is enabled.') }}
    </p>

    <template v-if="appMode === 'online'">
      <label class="online-config-only-toggle">
        <input
          type="checkbox"
          :checked="onlineConfigOnly"
          @change="onOnlineConfigOnlyChange"
        />
        <span>{{ t('onlineConfigOnlyToggle', 'Configuration only (do not load items)') }}</span>
      </label>

      <p v-if="!hasConnectionProfile" class="auth-note status-error">
        {{ t('dbConnectionRequired', 'Configure a saved connection profile before using online mode.') }}
        <button type="button" class="inline-link" @click="emit('open-connection-tab')">
          {{ t('dbConnectionOpenTab', 'Open Database Connection tab') }}
        </button>
      </p>
      <p v-if="!hasConnectionProfile && connectionProfileDebugMessage()" class="auth-note status-neutral">
        {{ connectionProfileDebugMessage() }}
      </p>

      <div v-else-if="!isAuthenticated" class="auth-user-card">
        <button type="button" class="transfer-btn transfer-btn-mode" @click="openLoginModal">
          {{ t('authLogin', 'Login') }}
        </button>
      </div>

      <div v-else class="auth-user-card">
        <button type="button" class="transfer-btn transfer-btn-reset" @click="onLogout">
          {{ t('authLogout', 'Logout') }}
        </button>
        <button
          type="button"
          class="transfer-btn transfer-btn-mode"
          :disabled="!props.hasPendingOnlineUpdates || props.saveStatus === 'saving'"
          @click="onSaveOnlineChanges"
        >
          {{
            props.saveStatus === 'saving'
              ? t('onlineSavePending', 'Saving...')
              : props.saveStatus === 'success'
                ? t('onlineSaveSuccess', 'Saved')
                : t('onlineSaveButton', 'Save changes')
          }}
        </button>
      </div>

      <p v-if="!isLoginModalOpen && (loginError || lastAuthError)" class="auth-note status-error">
        {{ loginError || lastAuthError }}
      </p>

      <p v-if="settingsStatus === 'loading'" class="auth-note status-neutral">
        {{ t('onlineSettingsLoading', 'Loading online settings...') }}
      </p>
      <p v-if="settingsStatus === 'error'" class="auth-note status-error">
        {{ lastSettingsError || t('onlineSettingsFailed', 'Could not load online settings.') }}
      </p>

      <p v-if="itemsStatus === 'loading'" class="auth-note status-neutral">
        {{ t('onlineItemsLoading', 'Loading online items...') }}
      </p>
      <p v-if="itemsStatus === 'error'" class="auth-note status-error">
        {{ lastItemsError || t('onlineItemsFailed', 'Could not load online items.') }}
      </p>

      <p v-if="isAuthenticated && props.hasPendingOnlineUpdates" class="auth-note status-neutral">
        {{
          t('onlineUnsavedChangesCount', 'Unsaved online changes in items:')
        }}
        {{ props.pendingOnlineUpdateCount }}
      </p>

      <p v-if="isAuthenticated && (props.saveError || props.saveStatus === 'error')" class="auth-note status-error">
        {{ props.saveError || t('onlineSaveFailed', 'Could not save online changes.') }}
        <button type="button" class="inline-link" @click="onSaveOnlineChanges">
          {{ t('onlineSaveRetry', 'Retry save') }}
        </button>
      </p>

      <p v-if="isAuthenticated && props.saveStatus === 'success'" class="auth-note status-success">
        {{ t('onlineSaveSuccessMessage', 'Online changes saved.') }}
      </p>
    </template>

    <div v-if="isLoginModalOpen" class="login-modal-backdrop" @click.self="closeLoginModal">
      <div class="login-modal" role="dialog" aria-modal="true">
        <h2>{{ t('authLogin', 'Login') }}</h2>
        <label>
          <span>{{ t('authIdentifier', 'Identifier (email or username)') }}</span>
          <input v-model="identifier" type="text" autocomplete="username" />
        </label>
        <label>
          <span>{{ t('authPassword', 'Password') }}</span>
          <div class="password-row">
            <input
              v-model="password"
              :type="showPassword ? 'text' : 'password'"
              autocomplete="current-password"
              @keydown.enter.prevent="onLogin"
            />
            <button
              type="button"
              class="password-toggle"
              :aria-label="showPassword ? t('authHidePassword', 'Hide') : t('authShowPassword', 'Show')"
              :title="showPassword ? t('authHidePassword', 'Hide') : t('authShowPassword', 'Show')"
              @click="showPassword = !showPassword"
            >
              <svg
                v-if="showPassword"
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
              >
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                <line x1="1" y1="1" x2="23" y2="23" />
              </svg>
              <svg
                v-else
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
              >
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </button>
          </div>
        </label>
        <p v-if="loginError || lastAuthError" class="auth-note status-error">
          {{ loginError || lastAuthError }}
        </p>
        <div class="login-modal-actions">
          <button type="button" class="transfer-btn transfer-btn-reset" @click="closeLoginModal">
            {{ t('cancel', 'Cancel') }}
          </button>
          <button type="button" class="transfer-btn transfer-btn-mode" :disabled="authStatus === 'authenticating'" @click="onLogin">
            {{ authStatus === 'authenticating' ? t('authLoginPending', 'Logging in...') : t('authLogin', 'Login') }}
          </button>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped lang="scss">
.online-access-panel {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.6rem;
}

.mode-switch {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.2rem 0.35rem;
  border: 1px solid color-mix(in srgb, var(--color-secondary) 35%, #cbd5e1);
  border-radius: 999px;
  background: color-mix(in srgb, var(--color-secondary) 8%, #f8fafc);
  width: fit-content;
}

.mode-btn {
  background: color-mix(in srgb, var(--color-secondary) 14%, #e2e8f0);
  color: color-mix(in srgb, var(--color-secondary) 78%, #0f172a);
  padding: 0.2rem 0.6rem;
  border-radius: 999px;
  border: 1px solid transparent;
  font-weight: 600;
}

.mode-btn.active {
  background: var(--color-secondary);
  color: var(--ve-color-white);
  border-color: var(--color-secondary);
}

.login-modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 50;
  background: var(--ve-color-backdrop);
  display: grid;
  place-items: center;
  padding: var(--ve-space-4);
}

.login-modal {
  width: min(92vw, 480px);
  background: var(--ve-color-white);
  border: 1px solid var(--ve-color-border-default);
  border-radius: 12px;
  padding: var(--ve-space-4);
  display: grid;
  gap: var(--ve-space-3);
}

.login-modal h2 {
  margin: 0;
  font-size: 1.2rem;
}

.login-modal label {
  display: grid;
  gap: 0.25rem;
}

.login-modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--ve-space-2);
}

.auth-user-card {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
}

.online-config-only-toggle {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  color: var(--ve-color-text-muted);
  font-size: 0.9rem;
}

.auth-note {
  margin: 0;
  font-size: 0.9rem;
  border: 1px solid transparent;
  border-radius: 8px;
  padding: 0.45rem 0.65rem;
}

.auth-note-inline {
  display: inline-flex;
  align-items: center;
}

.status-neutral {
  background: #f8fafc;
  border-color: #dbe3ee;
  color: #334155;
}

.status-success {
  background: #ecfdf3;
  border-color: #abefc6;
  color: #065f46;
}

.status-error {
  background: #fef3f2;
  border-color: #fecdca;
  color: #991b1b;
}

.inline-link {
  margin-left: 0.4rem;
  padding: 0;
  border: 0;
  background: transparent;
  color: currentColor;
  text-decoration: underline;
  cursor: pointer;
}

.password-row {
  display: flex;
  gap: 0.45rem;
  align-items: center;
}

.login-modal .password-row input {
  flex: 1 1 auto;
  min-width: 0;
}

.password-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--ve-color-border-default);
  background: var(--ve-color-surface-panel);
  color: var(--color-text-primary);
  border-radius: 8px;
  padding: 0.45rem;
  white-space: nowrap;
}

@media (max-width: 1000px) {
  .online-access-panel {
    min-width: 0;
  }
}
</style>
