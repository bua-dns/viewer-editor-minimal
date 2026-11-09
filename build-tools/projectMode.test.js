import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import {
  applyProjectHtml,
  findSecretLookingClientKeys,
  isProjectMode,
  mergePublicDirs,
  readProjectConfig,
  resolveProject,
} from './projectMode.js'

let tempRoot

function writeFile(relativePath, content) {
  const fileName = path.join(tempRoot, relativePath)
  fs.mkdirSync(path.dirname(fileName), { recursive: true })
  fs.writeFileSync(fileName, content)
}

function readFile(relativePath) {
  return fs.readFileSync(path.join(tempRoot, relativePath), 'utf8')
}

beforeEach(() => {
  tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'project-mode-'))
})

afterEach(() => {
  fs.rmSync(tempRoot, { recursive: true, force: true })
})

describe('isProjectMode', () => {
  test('keeps the generic build for Vite and Vitest default modes', () => {
    expect(isProjectMode('development')).toBe(false)
    expect(isProjectMode('production')).toBe(false)
    expect(isProjectMode('test')).toBe(false)
    expect(isProjectMode('xylothek')).toBe(true)
  })
})

describe('resolveProject', () => {
  test('returns null for the generic build', () => {
    expect(resolveProject({ mode: 'production', root: tempRoot })).toBeNull()
  })

  test('finds the project in the sibling config repo by convention', () => {
    const root = path.join(tempRoot, 'tool')
    writeFile('viewer-editor-projects/xylothek/project.json', '{"base":"/xylo/","title":"Xylothek"}')

    const project = resolveProject({ mode: 'xylothek', root })

    expect(project.dir).toBe(path.join(tempRoot, 'viewer-editor-projects', 'xylothek'))
    expect(project.publicDir).toBe(path.join(project.dir, 'public'))
    expect(project.outDir).toBe(path.join('dist-projects', 'xylothek'))
    expect(project.base).toBe('/xylo/')
    expect(project.title).toBe('Xylothek')
  })

  test('VIEWER_EDITOR_PROJECTS_DIR overrides the convention', () => {
    writeFile('elsewhere/demo/project.json', '{}')

    const project = resolveProject({
      mode: 'demo',
      root: path.join(tempRoot, 'tool'),
      env: { VIEWER_EDITOR_PROJECTS_DIR: path.join(tempRoot, 'elsewhere') },
    })

    expect(project.dir).toBe(path.join(tempRoot, 'elsewhere', 'demo'))
  })

  test('names the available projects when the requested one is missing', () => {
    writeFile('viewer-editor-projects/xylothek/project.json', '{}')

    expect(() => resolveProject({ mode: 'xylo', root: path.join(tempRoot, 'tool') })).toThrow(
      /Project "xylo" not found.*Available: xylothek/,
    )
  })

  test('rejects names that could leave the projects folder', () => {
    expect(() => resolveProject({ mode: '..', root: tempRoot })).toThrow(/Invalid project name/)
    expect(() => resolveProject({ mode: 'a/../b', root: tempRoot })).toThrow(/Invalid project name/)
  })
})

describe('readProjectConfig', () => {
  test('uses defaults when project.json is missing', () => {
    expect(readProjectConfig(tempRoot)).toEqual({ base: './', title: '', favicon: '' })
  })

  test('strips a leading slash from the favicon path', () => {
    writeFile('project.json', '{"favicon":"/img/icon.svg"}')
    expect(readProjectConfig(tempRoot).favicon).toBe('img/icon.svg')
  })

  test('rejects invalid JSON and wrong value types with the file name', () => {
    writeFile('project.json', '{ broken')
    expect(() => readProjectConfig(tempRoot)).toThrow(/project\.json: invalid JSON/)

    writeFile('project.json', '{"title": 3}')
    expect(() => readProjectConfig(tempRoot)).toThrow(/"title" must be a string/)
  })
})

describe('mergePublicDirs', () => {
  function mergeInto(projectFolder) {
    mergePublicDirs({
      genericDir: path.join(tempRoot, 'generic'),
      projectDir: path.join(tempRoot, projectFolder),
      targetDir: path.join(tempRoot, 'target'),
    })
  }

  test('lays project files over the generic public files', () => {
    writeFile('generic/app-config/viewer-editor-app-config.v1.json', 'generic config')
    writeFile('generic/app-config/wording.json', 'generic wording')
    writeFile('project/app-config/viewer-editor-app-config.v1.json', 'project config')
    writeFile('project/logo.svg', 'logo')
    writeFile('target/stale.txt', 'from an earlier run')

    mergeInto('project')

    expect(readFile('target/app-config/viewer-editor-app-config.v1.json')).toBe('project config')
    expect(readFile('target/app-config/wording.json')).toBe('generic wording')
    expect(readFile('target/logo.svg')).toBe('logo')
    expect(fs.existsSync(path.join(tempRoot, 'target/stale.txt'))).toBe(false)
  })

  test('works when the project has no public folder', () => {
    writeFile('generic/a.txt', 'a')

    mergeInto('missing')

    expect(readFile('target/a.txt')).toBe('a')
  })
})

describe('applyProjectHtml', () => {
  const html = '<head>\n<title>Viewer Editor Minimal</title>\n</head>'

  test('replaces the title and adds the favicon link', () => {
    const result = applyProjectHtml(html, { title: 'Xylothek & Co', favicon: 'favicon.svg' })

    expect(result).toContain('<title>Xylothek &amp; Co</title>')
    expect(result).toContain('<link rel="icon" href="/favicon.svg" />')
  })

  test('leaves the page unchanged without title and favicon', () => {
    expect(applyProjectHtml(html, { title: '', favicon: '' })).toBe(html)
  })
})

describe('findSecretLookingClientKeys', () => {
  test('flags only VITE_ keys whose names suggest a secret', () => {
    const env = { VITE_API_TOKEN: 'x', VITE_TITLE: 'x', STRAPI_TOKEN: 'x', VITE_APIKEY: 'x' }
    expect(findSecretLookingClientKeys(env)).toEqual(['VITE_API_TOKEN', 'VITE_APIKEY'])
  })
})
