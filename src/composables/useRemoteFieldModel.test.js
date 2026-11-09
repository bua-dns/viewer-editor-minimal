import { nextTick, ref } from 'vue'
import { describe, expect, test, vi } from 'vitest'
import { useRemoteFieldModel } from './useRemoteFieldModel'

const model = { source: 'schema', fields: [{ key: 'label', strapiType: 'string', suggestedType: 'normal' }] }

function setup({ needed = false } = {}) {
  const session = {
    appMode: ref('online'),
    isAuthenticated: ref(true),
    connectionProfile: ref({ baseUrl: 'https://x' }),
    token: ref('t'),
    onlineSettings: ref({ itemsPath: '/api/a' }),
  }
  const isNeeded = ref(needed)
  const fetchFieldModel = vi.fn(async () => model)
  const result = useRemoteFieldModel({ ...session, isNeeded: () => isNeeded.value, fetchFieldModel })
  return { ...result, ...session, isNeeded, fetchFieldModel }
}

async function settle() {
  await nextTick()
  await Promise.resolve()
  await nextTick()
}

describe('useRemoteFieldModel', () => {
  test('loads only once it is needed, and only once per context', async () => {
    const state = setup()
    await settle()
    expect(state.fetchFieldModel).not.toHaveBeenCalled()

    state.isNeeded.value = true
    await settle()
    expect(state.fieldModel.value).toMatchObject({ ...model, status: 'ready' })

    state.isNeeded.value = false
    await settle()
    state.isNeeded.value = true
    await settle()
    expect(state.fetchFieldModel).toHaveBeenCalledTimes(1)
  })

  test('loads again for another collection and on reload', async () => {
    const state = setup({ needed: true })
    await settle()

    state.onlineSettings.value = { itemsPath: '/api/b' }
    await settle()
    await state.reload()

    expect(state.fetchFieldModel).toHaveBeenCalledTimes(3)
    expect(state.fetchFieldModel.mock.calls[1][0]).toEqual({ profile: { baseUrl: 'https://x' }, token: 't', itemsPath: '/api/b' })
  })

  test('clears the model when the session leaves online mode or signs out', async () => {
    const state = setup({ needed: true })
    await settle()

    state.appMode.value = 'offline'
    await settle()
    expect(state.fieldModel.value).toMatchObject({ source: '', fields: [], status: 'idle' })

    state.appMode.value = 'online'
    state.isAuthenticated.value = false
    await settle()

    expect(state.fieldModel.value).toMatchObject({ source: '', fields: [], status: 'idle' })
  })

  test('loadStructuredFieldKeys loads the model on demand, once, and returns the structured keys', async () => {
    const state = setup()
    state.fetchFieldModel.mockResolvedValue({
      source: 'schema',
      fields: [
        { key: 'label', strapiType: 'string', isStructured: false },
        { key: 'place', strapiType: 'relation', isStructured: true },
        { key: 'extra', strapiType: 'json', isStructured: true },
      ],
    })

    const [first, second] = await Promise.all([state.loadStructuredFieldKeys(), state.loadStructuredFieldKeys()])

    expect(first).toEqual(['place', 'extra'])
    expect(second).toEqual(['place', 'extra'])
    expect(state.fetchFieldModel).toHaveBeenCalledTimes(1)
  })

  test('loadStructuredFieldKeys returns no keys when the model cannot be loaded', async () => {
    const state = setup()
    state.fetchFieldModel.mockRejectedValueOnce(new Error('Forbidden'))

    await expect(state.loadStructuredFieldKeys()).resolves.toEqual([])
  })

  test('reports a failed load', async () => {
    const state = setup({ needed: true })
    state.fetchFieldModel.mockRejectedValueOnce(new Error('Forbidden'))
    await state.reload()

    expect(state.fieldModel.value).toMatchObject({ status: 'error', errorMessage: 'Forbidden' })
  })
})
