// Derivation rules live in their own JSON prop `mappings` of the viewer-settings singleton,
// next to `settings`, `wording` and `replacements`.
import { strapiFetchJson } from './strapiApi'

function mappingsPropMissingError(payload) {
  const error = new Error(
    'Config update response must contain a list at data.mappings. Does the viewer settings type have a JSON prop named "mappings"?',
  )
  error.status = 500
  error.payload = payload
  return error
}

/** Writes the whole rule list (`PUT <configPath>` with `{ data: { mappings } }`), returns the stored list. */
export async function updateViewerMappingsInStrapi({ profile, token = '', mappings }) {
  if (!Array.isArray(mappings)) {
    throw new TypeError('Derivation rules must be a list.')
  }

  const payload = await strapiFetchJson({
    profile,
    path: profile.configPath,
    method: 'PUT',
    token,
    body: { data: { mappings } },
  })

  if (!Array.isArray(payload?.data?.mappings)) throw mappingsPropMissingError(payload)
  return payload.data.mappings
}
