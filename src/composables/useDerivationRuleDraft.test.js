import { nextTick, ref } from 'vue'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { useConnectionProfileStore } from '../stores/useConnectionProfileStore'
import { useDerivationRulesStore } from '../stores/useDerivationRulesStore'
import { useDerivationRuleDraft } from './useDerivationRuleDraft'

const storedRule = {
  source: '/api/index-cards',
  target: '/api/collection-items',
  label: { de: 'Als Objekt anlegen' },
  relationField: 'index_cards',
  fields: [
    { target: 'label', from: 'label', prefix: 'item_' },
    { target: 'status', value: 'draft' },
  ],
}

const targetModel = {
  source: 'schema',
  fields: [
    { key: 'label', strapiType: 'string', isStructured: false },
    { key: 'index_cards', strapiType: 'relation', isStructured: true },
    { key: 'image', strapiType: 'media', isStructured: true },
  ],
}

async function settle() {
  await nextTick()
  await Promise.resolve()
  await nextTick()
}

function setup(sourcePath = '/api/index-cards') {
  const updateMappings = vi.fn(async ({ mappings }) => mappings)
  const services = {
    fetchCollectionTypes: vi.fn(async () => [{ path: '/api/collection-items', name: 'Collection item' }]),
    fetchFieldModel: vi.fn(async () => targetModel),
  }
  const draftState = useDerivationRuleDraft({
    sourcePath: ref(sourcePath),
    session: () => ({ profile: { baseUrl: 'https://x' }, token: 't' }),
    services,
    saveRule: (rule) => useDerivationRulesStore().saveDerivationRule(rule, { updateMappings }),
  })
  return { ...draftState, services, updateMappings }
}

describe('useDerivationRuleDraft', () => {
  beforeEach(() => {
    useConnectionProfileStore().connectionProfile.value = { version: 1, baseUrl: 'https://x', configPath: '/api/viewer-setting' }
    useDerivationRulesStore().initializeDerivationRules([storedRule])
  })

  test('starts from the stored rule of the loaded collection and loads the target model', async () => {
    const state = setup()
    await settle()

    expect(state.draft.value).toMatchObject({
      source: '/api/index-cards',
      target: '/api/collection-items',
      labelDe: 'Als Objekt anlegen',
      relationField: 'index_cards',
    })
    expect(state.draft.value.rows.map((row) => [row.target, row.kind])).toEqual([
      ['label', 'copy'],
      ['status', 'constant'],
    ])
    expect(state.services.fetchFieldModel).toHaveBeenCalledWith(
      expect.objectContaining({ itemsPath: '/api/collection-items' }),
    )
    expect(state.isDirty.value).toBe(false)
    expect(state.errors.value).toEqual([])
  })

  test('offers only relation attributes of the target as relation field', async () => {
    const state = setup()
    await settle()
    expect(state.relationFieldOptions.value.map((field) => field.key)).toEqual(['index_cards'])
  })

  test('without a stored rule the draft is empty and cannot be saved', () => {
    const state = setup('/api/persons')
    expect(state.draft.value.rows).toEqual([])
    expect(state.canSave.value).toBe(false)
    expect(state.errors.value.map((error) => error.key)).toContain('deriveRuleTargetMissing')
  })

  test('an incomplete row blocks saving', async () => {
    const state = setup()
    await settle()
    state.addRow()
    expect(state.isDirty.value).toBe(false)
    expect(state.canSave.value).toBe(false)
    expect(state.errors.value.map((error) => error.key)).toEqual(['deriveRuleRowIncomplete'])
  })

  test('saves the edited rule through the store', async () => {
    const state = setup()
    await settle()
    state.draft.value.rows[0].prefix = 'obj_'
    expect(state.isDirty.value).toBe(true)

    const result = await state.save()
    await settle()

    expect(result.ok).toBe(true)
    expect(state.updateMappings.mock.calls[0][0].mappings[0].fields[0]).toEqual({
      target: 'label',
      from: 'label',
      prefix: 'obj_',
    })
    expect(state.draft.value.rows[0].prefix).toBe('obj_')
    expect(state.isDirty.value).toBe(false)
  })

  test('removing a row changes the rule', async () => {
    const state = setup()
    await settle()
    state.removeRow(state.draft.value.rows[1].key)
    expect(state.isDirty.value).toBe(true)
    expect(state.canSave.value).toBe(true)
  })
})
