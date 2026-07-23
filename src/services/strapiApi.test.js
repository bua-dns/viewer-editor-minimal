import { describe, expect, test, vi } from 'vitest'
import {
  buildStrapiUpdatePayload,
  normalizeStrapiItem,
  updateCollectionItemInStrapi,
} from './strapiApi'

describe('strapiApi helpers', () => {
  test('normalizes flattened Strapi v5 item with documentId', () => {
    const item = normalizeStrapiItem(
      {
        id: 1,
        documentId: 'doc-1',
        label: 'Card A',
        scan: 'https://example.org/a.jpg',
      },
      ['label'],
      '/api/index-cards?pagination[page]=1',
    )

    expect(item).toEqual({
      label: 'Card A',
      scan: 'https://example.org/a.jpg',
      __onlineMeta: {
        id: 'doc-1',
        idKind: 'documentId',
        idValue: 'doc-1',
        itemsPath: '/api/index-cards',
        updatedAt: undefined,
      },
    })
  })

  test('normalizes attributes shape and falls back to id', () => {
    const item = normalizeStrapiItem(
      {
        id: 17,
        attributes: {
          label: 'Card 17',
          updatedAt: '2026-07-22T00:00:00.000Z',
        },
      },
      ['label'],
      '/api/index-cards',
    )

    expect(item).toEqual({
      label: 'Card 17',
      __onlineMeta: {
        id: 17,
        idKind: 'id',
        idValue: 17,
        itemsPath: '/api/index-cards',
        updatedAt: '2026-07-22T00:00:00.000Z',
      },
    })
  })

  test('throws when no stable identifier exists', () => {
    expect(() => normalizeStrapiItem({ label: 'invalid' }, ['label'], '/api/index-cards')).toThrow(
      'stable identifier',
    )
  })

  test('builds update payload with data wrapper', () => {
    expect(buildStrapiUpdatePayload({ label: 'Changed' })).toEqual({
      data: {
        label: 'Changed',
      },
    })
  })

  test('updates collection item by resolved item path', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { id: 1 } }),
    })

    await updateCollectionItemInStrapi({
      profile: {
        baseUrl: 'https://cms.example.org/project',
      },
      itemsPath: '/api/index-cards?pagination[page]=1',
      id: 'doc-1',
      token: 'jwt-1',
      changedFields: {
        label: 'Changed',
      },
    })

    expect(globalThis.fetch).toHaveBeenCalledWith('https://cms.example.org/project/api/index-cards/doc-1', {
      method: 'PUT',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: 'Bearer jwt-1',
      },
      body: JSON.stringify({
        data: {
          label: 'Changed',
        },
      }),
    })
  })
})
