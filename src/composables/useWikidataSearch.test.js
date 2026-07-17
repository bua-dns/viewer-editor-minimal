import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { useWikidataSearch } from './useWikidataSearch'

function createJsonResponse(payload) {
  return {
    ok: true,
    json: async () => payload,
  }
}

describe('useWikidataSearch', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  test('keeps successful language results when one language fails', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    vi.stubGlobal(
      'fetch',
      vi.fn(async (url) => {
        const parsed = new URL(url)
        const action = parsed.searchParams.get('action')
        const language = parsed.searchParams.get('language')

        if (action !== 'wbsearchentities') {
          throw new Error(`Unexpected action: ${action}`)
        }

        if (language === 'de') {
          throw new Error('language endpoint failed')
        }

        return createJsonResponse({
          search: [
            { id: 'Q42', label: 'Douglas Adams', description: 'English writer' },
            { id: 'Q64', label: 'Berlin', description: 'capital city of Germany' },
          ],
        })
      }),
    )

    const { search } = useWikidataSearch()
    const results = await search('berlin', {
      searchLanguages: ['de', 'en'],
      resultLanguage: 'en',
      limit: 10,
    })

    expect(results).toEqual([
      {
        id: 'Q42',
        label: 'Douglas Adams',
        description: 'English writer',
        labels: { en: 'Douglas Adams' },
        descriptions: { en: 'English writer' },
      },
      {
        id: 'Q64',
        label: 'Berlin',
        description: 'capital city of Germany',
        labels: { en: 'Berlin' },
        descriptions: { en: 'capital city of Germany' },
      },
    ])
    expect(warnSpy).toHaveBeenCalledTimes(1)
  })

  test('rejects with AbortError when the request gets aborted', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    vi.stubGlobal(
      'fetch',
      vi.fn((url, options = {}) => {
        const parsed = new URL(url)
        if (parsed.searchParams.get('action') !== 'wbsearchentities') {
          throw new Error('Unexpected fetch call in abort test')
        }

        return new Promise((resolve, reject) => {
          const rejectAbort = () => reject(new DOMException('The request was aborted.', 'AbortError'))

          if (options.signal?.aborted) {
            rejectAbort()
            return
          }

          options.signal?.addEventListener('abort', rejectAbort, { once: true })

          setTimeout(() => {
            resolve(
              createJsonResponse({
                search: [{ id: 'Q64', label: 'Berlin', description: 'capital city of Germany' }],
              }),
            )
          }, 20)
        })
      }),
    )

    const controller = new AbortController()
    const { search } = useWikidataSearch()

    const request = search('berlin', {
      searchLanguages: ['de', 'en'],
      signal: controller.signal,
    })

    controller.abort()

    await expect(request).rejects.toMatchObject({ name: 'AbortError' })
    expect(warnSpy).not.toHaveBeenCalled()
  })

  test('supports claimPresence defs as property objects', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url) => {
        const parsed = new URL(url)
        const action = parsed.searchParams.get('action')

        if (action === 'wbsearchentities') {
          return createJsonResponse({
            search: [{ id: 'Q42', label: 'Douglas Adams', description: 'English writer' }],
          })
        }

        if (action === 'wbgetentities') {
          expect(parsed.searchParams.get('claims')).toBe('P31')
          return createJsonResponse({
            entities: {
              Q42: {
                claims: {
                  P31: [
                    {
                      mainsnak: {
                        datavalue: {
                          value: { id: 'Q5' },
                        },
                      },
                    },
                  ],
                },
              },
            },
          })
        }

        throw new Error(`Unexpected action: ${action}`)
      }),
    )

    const { search } = useWikidataSearch()
    const results = await search('douglas', {
      searchLanguages: ['en'],
      prioritize: {
        claimPresence: {
          weight: 5,
          defs: [{ propertyId: ' P31 ', propertyLabel: 'instance of' }],
        },
      },
    })

    expect(results).toHaveLength(1)
    expect(results[0].ranking.score).toBe(5)
    expect(results[0].prioritizationValues).toEqual({ P31: ['Q5'] })
  })

  test('fetches raw statement data for a property and entity', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url) => {
        const parsed = new URL(url)
        const action = parsed.searchParams.get('action')

        if (action !== 'wbgetentities') {
          throw new Error(`Unexpected action: ${action}`)
        }

        expect(parsed.searchParams.get('claims')).toBe('P31')
        expect(parsed.searchParams.get('ids')).toBe('Q42')

        return createJsonResponse({
          entities: {
            Q42: {
              claims: {
                P31: [
                  {
                    id: 'Q42$ABC',
                    mainsnak: {
                      snaktype: 'value',
                      property: 'P31',
                      datavalue: {
                        value: { id: 'Q5' },
                        type: 'wikibase-entityid',
                      },
                    },
                  },
                ],
              },
            },
          },
        })
      }),
    )

    const { fetchStatementDataForEntity } = useWikidataSearch()
    const statements = await fetchStatementDataForEntity('Q42', 'P31')

    expect(statements).toEqual([
      {
        id: 'Q42$ABC',
        mainsnak: {
          snaktype: 'value',
          property: 'P31',
          datavalue: {
            value: { id: 'Q5' },
            type: 'wikibase-entityid',
          },
        },
      },
    ])
  })

  test('fetches localized labels and descriptions in de and en', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url) => {
        const parsed = new URL(url)
        const action = parsed.searchParams.get('action')

        if (action !== 'wbgetentities') {
          throw new Error(`Unexpected action: ${action}`)
        }

        expect(parsed.searchParams.get('props')).toBe('labels|descriptions')
        expect(parsed.searchParams.get('languages')).toBe('de|en')
        expect(parsed.searchParams.get('ids')).toBe('Q42')

        return createJsonResponse({
          entities: {
            Q42: {
              labels: {
                de: { language: 'de', value: 'Douglas Adams' },
                en: { language: 'en', value: 'Douglas Adams' },
              },
              descriptions: {
                de: { language: 'de', value: 'britischer Schriftsteller' },
                en: { language: 'en', value: 'English writer' },
              },
            },
          },
        })
      }),
    )

    const { fetchEntityLocalizedTexts } = useWikidataSearch()
    const localizedTexts = await fetchEntityLocalizedTexts('Q42', { languages: ['de', 'en'] })

    expect(localizedTexts).toEqual({
      labels: {
        de: 'Douglas Adams',
        en: 'Douglas Adams',
      },
      descriptions: {
        de: 'britischer Schriftsteller',
        en: 'English writer',
      },
    })
  })
})
