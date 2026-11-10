import { beforeEach, describe, expect, test, vi } from 'vitest'
import { useConnectionProfileStore } from './useConnectionProfileStore'
import { useDerivationRulesStore } from './useDerivationRulesStore'

const cardRule = { source: '/api/index-cards', target: '/api/collection-items', relationField: 'index_cards', fields: [] }
const otherRule = { source: '/api/persons', target: '/api/places', relationField: 'persons', fields: [] }

describe('useDerivationRulesStore', () => {
  beforeEach(() => {
    useConnectionProfileStore().connectionProfile.value = {
      version: 1,
      baseUrl: 'https://cms.example.org/project',
      configPath: '/api/viewer-setting',
    }
    useDerivationRulesStore().initializeDerivationRules([cardRule, otherRule])
  })

  test('null from Strapi (prop not filled yet) means no rules', () => {
    const store = useDerivationRulesStore()
    store.initializeDerivationRules(null)
    expect(store.rules.value).toEqual([])
  })

  test('saving a rule replaces the one of its source and keeps the rules of other sources', async () => {
    const store = useDerivationRulesStore()
    const changed = { ...cardRule, target: '/api/objects' }
    const updateMappings = vi.fn(async ({ mappings }) => mappings)

    const result = await store.saveDerivationRule(changed, { updateMappings })

    expect(result.ok).toBe(true)
    expect(updateMappings.mock.calls[0][0].mappings).toEqual([
      { ...otherRule, label: {} },
      changed,
    ])
    expect(store.rules.value.map((rule) => rule.target)).toEqual(['/api/places', '/api/objects'])
    expect(store.saveStatus.value).toBe('saved')
  })

  test('a failed save keeps the loaded rules and reports the error', async () => {
    const store = useDerivationRulesStore()
    const updateMappings = vi.fn(async () => {
      throw new Error('Does the viewer settings type have a JSON prop named "mappings"?')
    })

    const result = await store.saveDerivationRule({ ...cardRule, target: '/api/objects' }, { updateMappings })

    expect(result.ok).toBe(false)
    expect(store.rules.value[0].target).toBe('/api/collection-items')
    expect(store.lastSaveError.value).toMatch(/mappings/)
  })
})
