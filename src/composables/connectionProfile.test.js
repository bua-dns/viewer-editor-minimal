import { describe, expect, test } from 'vitest'
import {
  createSavedConnectionProfile,
  joinBaseUrlAndPath,
  normalizeBaseUrl,
  normalizeConfigPath,
  parseConnectionProfileJsonText,
  validateConnectionProfile,
} from './connectionProfile'

describe('connection profile helpers', () => {
  test('normalizes baseUrl by trimming and removing trailing slash', () => {
    expect(normalizeBaseUrl(' https://example.org/base/ ')).toBe('https://example.org/base')
  })

  test('normalizes configPath to always start with slash', () => {
    expect(normalizeConfigPath('api/viewer-setting')).toBe('/api/viewer-setting')
  })

  test('validates required fields', () => {
    const result = validateConnectionProfile({
      baseUrl: '',
      configPath: '',
    })

    expect(result.ok).toBe(false)
    expect(result.errors.baseUrl).toBeTruthy()
    expect(result.errors.configPath).toBeTruthy()
  })

  test('creates save-ready profile with updatedAt', () => {
    const result = createSavedConnectionProfile({
      label: 'Test',
      baseUrl: 'https://example.org/path/',
      configPath: 'api/viewer-setting',
    })

    expect(result.version).toBe(1)
    expect(result.baseUrl).toBe('https://example.org/path')
    expect(result.configPath).toBe('/api/viewer-setting')
    expect(Date.parse(result.updatedAt)).not.toBeNaN()
  })

  test('parses JSON profile text', () => {
    const parsed = parseConnectionProfileJsonText('{"version":1}')
    expect(parsed.ok).toBe(true)
    expect(parsed.value.version).toBe(1)
  })

  test('joins baseUrl and endpoint path', () => {
    const fullUrl = joinBaseUrlAndPath('https://example.org/base', '/api/viewer-setting')
    expect(fullUrl).toBe('https://example.org/base/api/viewer-setting')
  })
})
