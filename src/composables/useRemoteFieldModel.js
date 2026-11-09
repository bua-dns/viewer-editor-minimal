// Loads the online collection's field model when it is needed (the configuration tab is open) and
// keeps it until the connection, the token or the collection changes, or `reload()` is called.
import { computed, ref, watch } from 'vue'
import { resolveItemsPathFromSettings } from '../services/strapiApi'
import { fetchCollectionFieldModelFromStrapi } from '../services/strapiDataModel'
import { createRequestSequence } from './requestSequence'

const EMPTY_MODEL = { source: '', fields: [] }

function contextKey(context) {
  return context ? [context.profile?.baseUrl, context.token, context.itemsPath].join('|') : ''
}

/**
 * @param {object} options Refs of the online session (`appMode`, `isAuthenticated`,
 *   `connectionProfile`, `token`, `onlineSettings`); `isNeeded()` says whether to load now;
 *   `fetchFieldModel` is injected in tests.
 * @returns `fieldModel`: `{ source: '' | 'schema' | 'sample', fields, status, errorMessage }` with
 *   status `idle | loading | ready | error`; `reload()`; and `loadStructuredFieldKeys()`.
 */
export function useRemoteFieldModel({
  appMode,
  isAuthenticated,
  connectionProfile,
  token,
  onlineSettings,
  isNeeded,
  fetchFieldModel = fetchCollectionFieldModelFromStrapi,
}) {
  const model = ref(EMPTY_MODEL)
  const status = ref('idle')
  const errorMessage = ref('')
  const loads = createRequestSequence()
  let loadedKey = ''

  // The online collection to describe, or null without a signed-in online session.
  function getContext() {
    const itemsPath = resolveItemsPathFromSettings(onlineSettings.value)
    const isSignedInOnline = appMode.value === 'online' && isAuthenticated.value
    if (!isSignedInOnline || !itemsPath) return null
    if (!connectionProfile.value) return null
    return { profile: connectionProfile.value, token: token.value || '', itemsPath }
  }

  function reset() {
    loads.invalidate()
    loadedKey = ''
    model.value = EMPTY_MODEL
    status.value = 'idle'
  }

  // The running or finished load of `loadedKey`, so a caller can wait for it.
  let currentLoad = Promise.resolve()

  async function fetchInto(context) {
    const isCurrent = loads.start()
    status.value = 'loading'
    errorMessage.value = ''
    try {
      const nextModel = await fetchFieldModel(context)
      if (!isCurrent()) return
      model.value = nextModel
      status.value = 'ready'
    } catch (error) {
      if (!isCurrent()) return
      model.value = EMPTY_MODEL
      status.value = 'error'
      errorMessage.value = String(error?.message || error)
    }
  }

  function load({ force = false } = {}) {
    const context = getContext()
    const key = contextKey(context)
    if (!key) {
      reset()
      return Promise.resolve()
    }
    const hasCurrentModel = key === loadedKey && status.value !== 'error'
    if (hasCurrentModel && !force) return currentLoad

    loadedKey = key
    currentLoad = fetchInto(context)
    return currentLoad
  }

  /**
   * The keys of the structured fields (relation, media, component, JSON, ...), loading the model
   * first when it is not there yet. Empty when the model cannot be loaded; never throws.
   */
  async function loadStructuredFieldKeys() {
    await load()
    return model.value.fields.filter((field) => field?.isStructured).map((field) => field.key)
  }

  watch(
    () => [isNeeded(), contextKey(getContext())],
    ([needed]) => {
      if (needed) load()
    },
    { immediate: true },
  )

  const fieldModel = computed(() => ({ ...model.value, status: status.value, errorMessage: errorMessage.value }))

  return { fieldModel, reload: () => load({ force: true }), loadStructuredFieldKeys }
}
