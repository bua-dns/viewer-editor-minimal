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
      { id: 'Q42', label: 'Douglas Adams', description: 'English writer' },
      { id: 'Q64', label: 'Berlin', description: 'capital city of Germany' },
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
})
