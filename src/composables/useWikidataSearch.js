const WIKIDATA_API_URL = 'https://www.wikidata.org/w/api.php'

const PRIORITY_BLOCK_HANDLERS = {
  claimPresence: {
    getRequiredProperties(defs) {
      if (!Array.isArray(defs)) return []
      return defs.filter((propertyId) => typeof propertyId === 'string' && propertyId.trim())
    },

    matches(entityClaims, defs) {
      if (!Array.isArray(defs)) return false
      return defs.some((propertyId) => {
        const claims = entityClaims[propertyId]
        return Array.isArray(claims) && claims.length > 0
      })
    },
  },

  claimValueMatch: {
    getRequiredProperties(defs) {
      if (!Array.isArray(defs)) return []
      return defs
        .map((definition) => definition?.property)
        .filter((propertyId) => typeof propertyId === 'string' && propertyId.trim())
    },

    matches(entityClaims, defs) {
      if (!Array.isArray(defs)) return false

      return defs.some((definition) => {
        const propertyId = definition?.property
        const expectedValue = definition?.value

        if (
          typeof propertyId !== 'string' ||
          !propertyId.trim() ||
          typeof expectedValue !== 'string' ||
          !expectedValue.trim()
        ) {
          return false
        }

        const claims = entityClaims[propertyId]
        if (!Array.isArray(claims) || claims.length === 0) {
          return false
        }

        return claims.some((claim) => getClaimValueId(claim) === expectedValue)
      })
    },
  },
}

function buildSearchUrl(query, options = {}) {
  const { language = 'de', resultLanguage = 'de', limit = 50, type = 'item' } = options

  const params = new URLSearchParams({
    action: 'wbsearchentities',
    format: 'json',
    origin: '*',
    search: query,
    language,
    uselang: resultLanguage,
    type,
    limit: String(limit),
  })

  return `${WIKIDATA_API_URL}?${params.toString()}`
}

function buildGetEntitiesUrl(ids, requiredProperties = []) {
  const params = new URLSearchParams({
    action: 'wbgetentities',
    format: 'json',
    origin: '*',
    ids: ids.join('|'),
    props: 'claims',
  })

  if (requiredProperties.length) {
    params.set('claims', requiredProperties.join('|'))
  }

  return `${WIKIDATA_API_URL}?${params.toString()}`
}

function normalizeResult(entity) {
  return {
    id: entity.id,
    label: entity.label || '',
    description: entity.description || '',
  }
}

function getClaimValueId(claim) {
  const rawValue = claim?.mainsnak?.datavalue?.value

  if (typeof rawValue === 'string') {
    return rawValue
  }

  if (rawValue && typeof rawValue === 'object' && typeof rawValue.id === 'string') {
    return rawValue.id
  }

  return null
}

function getClaimValueForDisplay(claim) {
  const rawValue = claim?.mainsnak?.datavalue?.value

  if (
    typeof rawValue === 'string' ||
    typeof rawValue === 'number' ||
    typeof rawValue === 'boolean'
  ) {
    return String(rawValue)
  }

  if (rawValue && typeof rawValue === 'object' && typeof rawValue.id === 'string') {
    return rawValue.id
  }

  return null
}

function parsePrioritizationBlocks(prioritize) {
  if (!prioritize || typeof prioritize !== 'object') {
    return []
  }

  return Object.entries(prioritize)
    .map(([ruleName, ruleConfig]) => {
      const handler = PRIORITY_BLOCK_HANDLERS[ruleName]

      if (!handler || !ruleConfig || typeof ruleConfig !== 'object') {
        return null
      }

      const weight = Number(ruleConfig.weight)
      if (!Number.isFinite(weight) || weight < 0) {
        return null
      }

      return {
        ruleName,
        weight,
        defs: ruleConfig.defs,
        handler,
      }
    })
    .filter(Boolean)
}

function collectRequiredProperties(prioritizationBlocks) {
  const propertyIds = new Set()

  for (const block of prioritizationBlocks) {
    const requiredProperties = block.handler.getRequiredProperties(block.defs)

    for (const propertyId of requiredProperties) {
      propertyIds.add(propertyId)
    }
  }

  return Array.from(propertyIds)
}

function chunkArray(items, size) {
  const chunks = []

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size))
  }

  return chunks
}

async function fetchEntityClaimsById(ids, requiredProperties) {
  if (!ids.length || !requiredProperties.length) {
    return new Map()
  }

  const idChunks = chunkArray(ids, 50)
  const requests = idChunks.map((chunk) =>
    fetch(buildGetEntitiesUrl(chunk, requiredProperties)).then(async (response) => {
      if (!response.ok) {
        throw new Error(`Wikidata request failed (${response.status})`)
      }

      const data = await response.json()
      return data?.entities && typeof data.entities === 'object' ? data.entities : {}
    }),
  )

  const settled = await Promise.all(requests)
  const claimsById = new Map()

  for (const entities of settled) {
    for (const [entityId, entity] of Object.entries(entities)) {
      claimsById.set(entityId, entity?.claims && typeof entity.claims === 'object' ? entity.claims : {})
    }
  }

  return claimsById
}

function getRankingForEntity(entityClaims, prioritizationBlocks) {
  let score = 0
  const matchedRules = []

  for (const block of prioritizationBlocks) {
    if (block.handler.matches(entityClaims, block.defs)) {
      score += block.weight
      matchedRules.push(block.ruleName)
    }
  }

  return {
    score,
    matchedRules,
  }
}

function getPrioritizationValues(entityClaims, requiredProperties) {
  const prioritizationValues = {}

  for (const propertyId of requiredProperties) {
    const claims = entityClaims[propertyId]
    if (!Array.isArray(claims) || !claims.length) {
      continue
    }

    const values = claims.map(getClaimValueForDisplay).filter((value) => value !== null)
    if (!values.length) {
      continue
    }

    prioritizationValues[propertyId] = Array.from(new Set(values))
  }

  return prioritizationValues
}

function rankResults(results, claimsById, prioritizationBlocks, requiredProperties) {
  return results
    .map((item, index) => {
      const entityClaims = claimsById.get(item.id) || {}
      const ranking = getRankingForEntity(entityClaims, prioritizationBlocks)
      const prioritizationValues = getPrioritizationValues(entityClaims, requiredProperties)

      return {
        ...item,
        ranking,
        prioritizationValues,
        _originalOrder: index,
      }
    })
    .sort((left, right) => {
      if (right.ranking.score !== left.ranking.score) {
        return right.ranking.score - left.ranking.score
      }

      return left._originalOrder - right._originalOrder
    })
    .map(({ _originalOrder, ...item }) => item)
}

export function useWikidataSearch() {
  async function search(query, options = {}) {
    const {
      searchLanguages = ['de', 'en'],
      resultLanguage = 'de',
      limit: rawLimit = 10,
      prioritize,
    } = options

    const normalizedLimit = Number(rawLimit)
    const limit = Number.isFinite(normalizedLimit) && normalizedLimit > 0
      ? Math.min(Math.floor(normalizedLimit), 50)
      : 10

    const normalizedQuery = String(query || '').trim()
    if (!normalizedQuery) {
      return []
    }

    const languages =
      Array.isArray(searchLanguages) && searchLanguages.length ? searchLanguages : ['de', 'en']

    const requests = languages.map((language) =>
      fetch(
        buildSearchUrl(normalizedQuery, {
          language,
          resultLanguage,
          limit,
        }),
      ).then(async (response) => {
        if (!response.ok) {
          throw new Error(`Wikidata request failed (${response.status})`)
        }

        const data = await response.json()
        const entities = Array.isArray(data.search) ? data.search : []
        return entities.map(normalizeResult)
      }),
    )

    const settled = await Promise.all(requests)
    const byId = new Map()

    for (const resultSet of settled) {
      for (const item of resultSet) {
        if (!byId.has(item.id)) {
          byId.set(item.id, item)
        }
      }
    }

    const mergedResults = Array.from(byId.values())
    const prioritizationBlocks = parsePrioritizationBlocks(prioritize)

    if (!prioritizationBlocks.length) {
      return mergedResults.slice(0, limit)
    }

    const requiredProperties = collectRequiredProperties(prioritizationBlocks)
    if (!requiredProperties.length) {
      return mergedResults.slice(0, limit)
    }

    const entityIds = mergedResults.map((item) => item.id)
    const claimsById = await fetchEntityClaimsById(entityIds, requiredProperties)

    return rankResults(mergedResults, claimsById, prioritizationBlocks, requiredProperties).slice(0, limit)
  }

  return {
    search,
  }
}
