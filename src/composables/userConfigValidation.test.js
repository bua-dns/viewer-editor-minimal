import { describe, expect, test } from 'vitest'
import { validateImportedConfigPayload } from './userConfigValidation'

describe('validateImportedConfigPayload', () => {
  test('accepts valid payload', () => {
    const result = validateImportedConfigPayload({
      itemLabelField: 'species',
      markAsEditedBasis: 'species',
      showOnlyNonEmptyFields: true,
      fields: {
        species: {
          type: 'normal',
          readOnly: true,
          label: '',
          order: 0,
          placeholder: '',
          hint: '',
        },
      },
    })
    expect(result.ok).toBe(true)
  })

  test('rejects non-string itemLabelField', () => {
    const result = validateImportedConfigPayload({
      itemLabelField: 5,
      fields: {
        species: {
          type: 'normal',
        },
      },
    })

    expect(result.ok).toBe(false)
  })

  test('rejects itemLabelField when missing in fields', () => {
    const result = validateImportedConfigPayload({
      itemLabelField: 'inventory_number',
      fields: {
        species: {
          type: 'normal',
        },
      },
    })

    expect(result.ok).toBe(false)
  })

  test('rejects non-string markAsEditedBasis', () => {
    const result = validateImportedConfigPayload({
      markAsEditedBasis: 5,
      fields: {
        species: {
          type: 'normal',
        },
      },
    })

    expect(result.ok).toBe(false)
  })

  test('rejects markAsEditedBasis when missing in fields', () => {
    const result = validateImportedConfigPayload({
      markAsEditedBasis: 'edited_note',
      fields: {
        species: {
          type: 'normal',
        },
      },
    })

    expect(result.ok).toBe(false)
  })

  test('rejects non-boolean showOnlyNonEmptyFields', () => {
    const result = validateImportedConfigPayload({
      showOnlyNonEmptyFields: 'yes',
      fields: {
        species: {
          type: 'normal',
        },
      },
    })

    expect(result.ok).toBe(false)
  })

  test('accepts autosuggest object on wikidata-autosuggest fields', () => {
    const result = validateImportedConfigPayload({
      fields: {
        subject: {
          type: 'wikidata-autosuggest',
          autosuggest: {
            searchLanguages: ['de', 'en'],
            prioritize: {
              claimValueMatch: {
                property: 'P31',
                value: 'Q5',
              },
            },
          },
        },
      },
    })

    expect(result.ok).toBe(true)
  })

  test('rejects missing fields object', () => {
    const result = validateImportedConfigPayload({ version: 1 })
    expect(result.ok).toBe(false)
  })

  test('rejects invalid field type', () => {
    const result = validateImportedConfigPayload({
      fields: {
        species: {
          type: 'date',
        },
      },
    })
    expect(result.ok).toBe(false)
  })

  test('rejects non-object autosuggest config', () => {
    const result = validateImportedConfigPayload({
      fields: {
        subject: {
          type: 'wikidata-autosuggest',
          autosuggest: ['de'],
        },
      },
    })

    expect(result.ok).toBe(false)
  })

  test('rejects autosuggest on non-wikidata field types', () => {
    const result = validateImportedConfigPayload({
      fields: {
        subject: {
          type: 'normal',
          autosuggest: {
            minChars: 2,
          },
        },
      },
    })

    expect(result.ok).toBe(false)
  })

  test('accepts autosuggest prefillWith on normal source fields', () => {
    const result = validateImportedConfigPayload({
      fields: {
        title: {
          type: 'normal',
        },
        subject: {
          type: 'wikidata-autosuggest',
          autosuggest: {
            prefillWith: 'title',
          },
        },
      },
    })

    expect(result.ok).toBe(true)
  })

  test('rejects autosuggest prefillWith when source field is missing', () => {
    const result = validateImportedConfigPayload({
      fields: {
        subject: {
          type: 'wikidata-autosuggest',
          autosuggest: {
            prefillWith: 'title',
          },
        },
      },
    })

    expect(result.ok).toBe(false)
  })

  test('rejects autosuggest prefillWith when source field is not normal string', () => {
    const result = validateImportedConfigPayload({
      fields: {
        title: {
          type: 'text',
        },
        subject: {
          type: 'wikidata-autosuggest',
          autosuggest: {
            prefillWith: 'title',
          },
        },
      },
    })

    expect(result.ok).toBe(false)
  })

  test('accepts autosuggest alsoGetDataFrom with valid property id', () => {
    const result = validateImportedConfigPayload({
      fields: {
        subject: {
          type: 'wikidata-autosuggest',
          autosuggest: {
            alsoGetDataFrom: 'P31',
          },
        },
      },
    })

    expect(result.ok).toBe(true)
  })

  test('rejects autosuggest alsoGetDataFrom when property id is invalid', () => {
    const result = validateImportedConfigPayload({
      fields: {
        subject: {
          type: 'wikidata-autosuggest',
          autosuggest: {
            alsoGetDataFrom: 'Q5',
          },
        },
      },
    })

    expect(result.ok).toBe(false)
  })

  test('rejects non-boolean readOnly', () => {
    const result = validateImportedConfigPayload({
      fields: {
        species: {
          type: 'normal',
          readOnly: 'yes',
        },
      },
    })

    expect(result.ok).toBe(false)
  })

  test('rejects readOnly on wikidata-autosuggest fields', () => {
    const result = validateImportedConfigPayload({
      fields: {
        subject: {
          type: 'wikidata-autosuggest',
          readOnly: true,
        },
      },
    })

    expect(result.ok).toBe(false)
  })

  test('rejects non-string hint', () => {
    const result = validateImportedConfigPayload({
      fields: {
        species: {
          type: 'normal',
          hint: 123,
        },
      },
    })

    expect(result.ok).toBe(false)
  })
})
