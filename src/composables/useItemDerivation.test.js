import { ref } from 'vue'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { useDerivationRulesStore } from '../stores/useDerivationRulesStore'
import { useItemDerivation } from './useItemDerivation'

const mappings = [
  {
    source: '/api/index-cards',
    target: '/api/collection-items',
    relationField: 'index_cards',
    fields: [
      { target: 'label', from: 'label', prefix: 'item_' },
      { target: 'name', from: 'ai_scientific_name' },
      { target: 'status', value: 'draft' },
    ],
  },
]

const serverRow = { documentId: 'card-1', label: '0_00571', ai_scientific_name: 'Pandanus hornei' }

const plainSourceModel = { source: 'schema', fields: [{ key: 'label', strapiType: 'string', isStructured: false }] }

function setup({ enabled = true, pending = false, saveResult = true, item, row = serverRow, sourceModel = plainSourceModel, componentSchemas = {} } = {}) {
  const state = {
    enabled: ref(enabled),
    onlineSettings: ref({ itemsPath: '/api/index-cards' }),
    canEdit: ref(true),
    selectedItem: ref(
      item || { label: '0_00571', __onlineMeta: { id: 'card-1', idKind: 'documentId', itemsPath: '/api/index-cards' } },
    ),
    hasPendingChanges: ref(pending),
  }
  const saveChanges = vi.fn(async () => {
    state.hasPendingChanges.value = false
    return saveResult
  })
  const services = {
    fetchRow: vi.fn(async () => row),
    createItem: vi.fn(async ({ fields }) => ({ data: { documentId: 'new-1', ...fields } })),
    fetchFieldModel: vi.fn(async () => sourceModel),
    fetchComponentSchemas: vi.fn(async () => componentSchemas),
  }
  const onCreated = vi.fn()
  const derivation = useItemDerivation({
    isEnabled: () => state.enabled.value,
    canEditRules: () => state.canEdit.value,
    onlineSettings: state.onlineSettings,
    language: ref('de'),
    selectedItem: state.selectedItem,
    hasPendingChanges: state.hasPendingChanges,
    saveChanges,
    t: (_key, fallback) => fallback,
    session: () => ({ profile: { baseUrl: 'https://x' }, token: 't' }),
    services,
    onCreated,
  })
  return { ...state, ...derivation, saveChanges, services, onCreated }
}

describe('useItemDerivation', () => {
  beforeEach(() => {
    useDerivationRulesStore().initializeDerivationRules(mappings)
  })

  test('offers the action only when switched on and a rule exists for the loaded collection', () => {
    expect(setup().canDerive.value).toBe(true)
    expect(setup({ enabled: false }).canDerive.value).toBe(false)

    const other = setup()
    other.onlineSettings.value = { itemsPath: '/api/persons' }
    expect(other.canDerive.value).toBe(false)
  })

  test('labels the action from the rule, else with the default text', () => {
    useDerivationRulesStore().initializeDerivationRules([{ ...mappings[0], label: { de: 'Als Objekt anlegen' } }])
    expect(setup().actionLabel.value).toBe('Als Objekt anlegen')
    useDerivationRulesStore().initializeDerivationRules(mappings)
    expect(setup().actionLabel.value).toBe('Derive item')
  })

  test('shows the rule editor only when switched on and the settings are writable', () => {
    const state = setup()
    expect(state.editorSourcePath.value).toBe('/api/index-cards')
    state.canEdit.value = false
    expect(state.editorSourcePath.value).toBe('')
    expect(setup({ enabled: false }).editorSourcePath.value).toBe('')
  })

  test('previews the values from the server row, with the unsaved local edits on top', async () => {
    const state = setup({
      pending: true,
      item: { label: 'edited', __onlineMeta: { id: 'card-1', idKind: 'documentId', itemsPath: '/api/index-cards' } },
    })
    await state.openDerivation()

    expect(state.dialog.value).toMatchObject({
      isOpen: true,
      phase: 'preview',
      targetPath: '/api/collection-items',
      willSaveFirst: true,
    })
    expect(state.dialog.value.preview).toEqual([
      { field: 'label', value: 'item_edited' },
      { field: 'name', value: 'Pandanus hornei' },
      { field: 'status', value: 'draft' },
    ])
    expect(state.services.createItem).not.toHaveBeenCalled()
  })

  test('creates the target item linked to the source and reports its label and ID', async () => {
    const state = setup()
    await state.openDerivation()
    await state.confirmDerivation()

    expect(state.saveChanges).not.toHaveBeenCalled()
    expect(state.services.createItem).toHaveBeenCalledWith(
      expect.objectContaining({
        itemsPath: '/api/collection-items',
        fields: {
          label: 'item_0_00571',
          name: 'Pandanus hornei',
          status: 'draft',
          index_cards: { connect: [{ documentId: 'card-1' }] },
        },
      }),
    )
    expect(state.dialog.value).toMatchObject({ phase: 'done', created: { id: 'new-1', label: 'item_0_00571' } })
    expect(state.onCreated).toHaveBeenCalledWith({ targetPath: '/api/collection-items', documentId: 'new-1' })
  })

  test('saves pending changes first and then reads the saved source item', async () => {
    const state = setup({ pending: true })
    await state.openDerivation()
    await state.confirmDerivation()

    expect(state.saveChanges).toHaveBeenCalledTimes(1)
    expect(state.saveChanges.mock.invocationCallOrder[0]).toBeLessThan(
      state.services.createItem.mock.invocationCallOrder[0],
    )
    expect(state.services.fetchRow).toHaveBeenCalledTimes(2)
  })

  test('creates nothing when saving the pending changes fails', async () => {
    const state = setup({ pending: true, saveResult: false })
    await state.openDerivation()
    await state.confirmDerivation()

    expect(state.services.createItem).not.toHaveBeenCalled()
    expect(state.dialog.value).toMatchObject({ phase: 'error' })
    expect(state.dialog.value.error).toMatch(/no item was created/)
  })

  test('an unsaved draft is saved first and linked by the identity it got from the server', async () => {
    const draft = { label: 'new card', __onlineMeta: { isDraft: true, draftId: 'd1', itemsPath: '/api/index-cards' } }
    const state = setup({ pending: true, item: draft })
    state.saveChanges.mockImplementation(async () => {
      draft.__onlineMeta = { id: 'card-9', idKind: 'documentId', itemsPath: '/api/index-cards' }
      state.hasPendingChanges.value = false
      return true
    })
    await state.openDerivation()
    expect(state.services.fetchRow).not.toHaveBeenCalled()

    await state.confirmDerivation()
    const { fields } = state.services.createItem.mock.calls[0][0]
    expect(fields.index_cards).toEqual({ connect: [{ documentId: 'card-9' }] })
  })

  test('says that the item may exist when the create request ends without an answer', async () => {
    const state = setup()
    state.services.createItem.mockRejectedValue(Object.assign(new Error('timeout'), { outcomeUnknown: true }))
    await state.openDerivation()
    await state.confirmDerivation()

    expect(state.dialog.value.phase).toBe('error')
    expect(state.dialog.value.error).toMatch(/may have been created/)
  })

  describe('component fields', () => {
    const collectorsField = {
      key: 'collectors',
      strapiType: 'component',
      isStructured: true,
      component: 'shared.wikidata-entity',
      repeatable: true,
    }
    const componentModel = { source: 'schema', fields: [...plainSourceModel.fields, collectorsField] }
    const componentSchemas = {
      'shared.wikidata-entity': {
        wikidata_id: { type: 'string' },
        label: { type: 'string' },
        additional_data: { type: 'json' },
        portrait: { type: 'media' },
      },
    }
    const collectorsRow = {
      ...serverRow,
      collectors: [
        {
          id: 10,
          wikidata_id: 'Q2688176',
          label: 'Paul Ernst Emil Sintenis',
          portrait: { id: 3, url: '/uploads/p.jpg' },
          additional_data: { statementData: { P227: [{ id: 'Q2688176$4BD73389', rank: 'normal' }] } },
        },
      ],
    }

    beforeEach(() => {
      useDerivationRulesStore().initializeDerivationRules([
        { ...mappings[0], fields: [...mappings[0].fields, { target: 'collectors', from: 'collectors' }] },
      ])
    })

    test('populates the copied component and sends it without database ids and media', async () => {
      const state = setup({ row: collectorsRow, sourceModel: componentModel, componentSchemas })
      await state.openDerivation()
      await state.confirmDerivation()

      expect(state.services.fetchRow).toHaveBeenLastCalledWith(expect.objectContaining({ populateFields: ['collectors'] }))
      const { fields } = state.services.createItem.mock.calls[0][0]
      expect(fields.collectors).toEqual([
        {
          wikidata_id: 'Q2688176',
          label: 'Paul Ernst Emil Sintenis',
          additional_data: { statementData: { P227: [{ id: 'Q2688176$4BD73389', rank: 'normal' }] } },
        },
      ])
    })

    test('loads the models at create time when the source was a draft during the preview', async () => {
      const draft = { label: 'new card', __onlineMeta: { isDraft: true, draftId: 'd1', itemsPath: '/api/index-cards' } }
      const state = setup({ pending: true, item: draft, row: collectorsRow, sourceModel: componentModel, componentSchemas })
      state.saveChanges.mockImplementation(async () => {
        draft.__onlineMeta = { id: 'card-9', idKind: 'documentId', itemsPath: '/api/index-cards' }
        state.hasPendingChanges.value = false
        return true
      })
      await state.openDerivation()
      expect(state.services.fetchFieldModel).not.toHaveBeenCalled()

      await state.confirmDerivation()
      const { fields } = state.services.createItem.mock.calls[0][0]
      expect(fields.collectors[0]).not.toHaveProperty('id')
    })

    test('a rule with the stored structure works for a role that cannot read the schema', async () => {
      const structure = { type: 'component', component: 'shared.wikidata-entity', repeatable: true }
      useDerivationRulesStore().initializeDerivationRules([
        { ...mappings[0], fields: [{ target: 'collectors', from: 'collectors', structure }] },
      ])
      const state = setup({ row: collectorsRow, sourceModel: { source: 'sample', fields: [] } })
      state.services.fetchComponentSchemas.mockResolvedValue({})
      await state.openDerivation()
      await state.confirmDerivation()

      expect(state.services.fetchFieldModel).not.toHaveBeenCalled()
      expect(state.services.fetchRow).toHaveBeenLastCalledWith(expect.objectContaining({ populateFields: ['collectors'] }))
      const { fields } = state.services.createItem.mock.calls[0][0]
      expect(fields.collectors[0]).not.toHaveProperty('id')
      expect(fields.collectors[0].wikidata_id).toBe('Q2688176')
    })

    test('an older rule without structure and without schema access stops with a hint instead of dropping data', async () => {
      const item = {
        label: '0_00571',
        collectors: [{ id: 'Q2688176', label: 'Sintenis' }],
        __onlineMeta: { id: 'card-1', idKind: 'documentId', itemsPath: '/api/index-cards' },
      }
      const state = setup({ item, row: serverRow, sourceModel: { source: 'sample', fields: [{ key: 'collectors', strapiType: 'json', isStructured: true }] } })
      await state.openDerivation()

      expect(state.dialog.value.phase).toBe('error')
      expect(state.dialog.value.error).toMatch(/does not know the structure of collectors.*save it again/)
      expect(state.services.createItem).not.toHaveBeenCalled()
    })

    test('without readable component schemas the entry ids still go, nested media stays', async () => {
      const structure = { type: 'component', component: 'shared.wikidata-entity', repeatable: true }
      useDerivationRulesStore().initializeDerivationRules([
        { ...mappings[0], fields: [{ target: 'collectors', from: 'collectors', structure }] },
      ])
      const state = setup({ row: collectorsRow, sourceModel: componentModel })
      state.services.fetchComponentSchemas.mockRejectedValue(new Error('403'))
      await state.openDerivation()
      await state.confirmDerivation()

      const { fields } = state.services.createItem.mock.calls[0][0]
      expect(fields.collectors[0]).not.toHaveProperty('id')
      expect(fields.collectors[0].portrait).toEqual({ id: 3, url: '/uploads/p.jpg' })
    })
  })

  test('cannot be closed while the item is being created', async () => {
    const state = setup()
    await state.openDerivation()
    state.dialog.value = { ...state.dialog.value, phase: 'running' }
    state.closeDerivation()
    expect(state.dialog.value.isOpen).toBe(true)
  })
})
