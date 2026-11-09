// Project modes: `pnpm dev --mode <project>` / `pnpm build --mode <project>` build the
// generic app with the files of one project from the separate config repo laid over
// `public/`. Runs in Node (vite.config.js), never in the browser.
import fs from 'node:fs'
import path from 'node:path'

// Modes Vite and Vitest use on their own; they keep the generic build.
const GENERIC_MODES = new Set(['development', 'production', 'test'])
export const DEFAULT_PROJECTS_DIR = '../viewer-editor-projects'
export const PROJECTS_DIR_ENV_KEY = 'VIEWER_EDITOR_PROJECTS_DIR'
const PROJECT_FILE = 'project.json'
const PROJECT_NAME_PATTERN = /^[a-z0-9][a-z0-9_-]*$/i
const SECRET_LOOKING_KEY = /TOKEN|SECRET|PASSWORD|PRIVATE|API_?KEY/i
const DEFAULT_PROJECT_CONFIG = { base: './', title: '', favicon: '' }

export function isProjectMode(mode) {
  return Boolean(mode) && !GENERIC_MODES.has(mode)
}

function listProjects(projectsDir) {
  if (!fs.existsSync(projectsDir)) return []
  return fs
    .readdirSync(projectsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
    .map((entry) => entry.name)
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function readStringOption(config, key, fileName) {
  const value = config[key]
  if (value === undefined) return DEFAULT_PROJECT_CONFIG[key]
  if (typeof value !== 'string') throw new Error(`${fileName}: "${key}" must be a string.`)
  return value.trim()
}

// project.json is optional; every key has a default.
export function readProjectConfig(projectDir) {
  const fileName = path.join(projectDir, PROJECT_FILE)
  if (!fs.existsSync(fileName)) return { ...DEFAULT_PROJECT_CONFIG }

  let parsed
  try {
    parsed = JSON.parse(fs.readFileSync(fileName, 'utf8'))
  } catch (error) {
    throw new Error(`${fileName}: invalid JSON (${error.message}).`)
  }
  if (!isPlainObject(parsed)) {
    throw new Error(`${fileName}: must contain a JSON object.`)
  }

  return {
    base: readStringOption(parsed, 'base', fileName) || DEFAULT_PROJECT_CONFIG.base,
    title: readStringOption(parsed, 'title', fileName),
    favicon: readStringOption(parsed, 'favicon', fileName).replace(/^\/+/, ''),
  }
}

// Returns null for the generic build, else everything vite.config.js needs for the project.
// `env` holds the build-tool variables (VIEWER_EDITOR_PROJECTS_DIR), not the project's.
export function resolveProject({ mode, root, env = {} }) {
  if (!isProjectMode(mode)) return null
  if (!PROJECT_NAME_PATTERN.test(mode)) {
    throw new Error(`Invalid project name "${mode}": use letters, digits, "-" and "_" only.`)
  }

  const projectsDir = path.resolve(root, env[PROJECTS_DIR_ENV_KEY] || DEFAULT_PROJECTS_DIR)
  const dir = path.join(projectsDir, mode)
  if (!fs.existsSync(dir)) {
    const available = listProjects(projectsDir)
    const hint = available.length ? `Available: ${available.join(', ')}.` : 'No projects found there.'
    throw new Error(`Project "${mode}" not found in ${projectsDir}. ${hint}`)
  }

  return {
    name: mode,
    dir,
    publicDir: path.join(dir, 'public'),
    mergedPublicDir: path.join(root, '.vite', 'project-public', mode),
    outDir: path.join('dist-projects', mode),
    ...readProjectConfig(dir),
  }
}

// Generic `public/` first, then the project's files on top: a project file replaces the
// generic file with the same path.
export function mergePublicDirs({ genericDir, projectDir, targetDir }) {
  fs.rmSync(targetDir, { recursive: true, force: true })
  fs.mkdirSync(targetDir, { recursive: true })
  for (const sourceDir of [genericDir, projectDir]) {
    if (fs.existsSync(sourceDir)) fs.cpSync(sourceDir, targetDir, { recursive: true })
  }
}

function escapeHtml(value) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export function applyProjectHtml(html, { title, favicon }) {
  let result = html
  if (title) result = result.replace(/<title>[\s\S]*?<\/title>/, `<title>${escapeHtml(title)}</title>`)
  if (favicon) {
    // Root-relative: Vite rewrites public-file URLs in index.html to the configured base.
    result = result.replace('</head>', `  <link rel="icon" href="/${escapeHtml(favicon)}" />\n  </head>`)
  }
  return result
}

// VITE_* values are compiled into the bundle and readable by every visitor.
export function findSecretLookingClientKeys(env) {
  return Object.keys(env || {}).filter((key) => key.startsWith('VITE_') && SECRET_LOOKING_KEY.test(key))
}

function watchAndRemerge(server, mergeArgs) {
  const sourceDirs = [mergeArgs.genericDir, mergeArgs.projectDir].map((dir) => path.resolve(dir))
  server.watcher.add(sourceDirs)
  server.watcher.on('all', (_event, changedPath) => {
    const resolved = path.resolve(changedPath)
    if (!sourceDirs.some((dir) => resolved.startsWith(dir + path.sep))) return
    mergePublicDirs(mergeArgs)
    server.ws.send({ type: 'full-reload' })
  })
}

export function projectModePlugin(project, mergeArgs) {
  return {
    name: 'viewer-editor-project-mode',
    transformIndexHtml: {
      order: 'pre',
      handler: (html) => applyProjectHtml(html, project),
    },
    configResolved(config) {
      const keys = findSecretLookingClientKeys(config.env)
      if (keys.length) {
        config.logger.warn(
          `[project ${project.name}] ${keys.join(', ')} will be readable in the browser bundle. ` +
            'Drop the VITE_ prefix for build-time secrets.',
        )
      }
      config.logger.info(`[project ${project.name}] ${project.dir}`)
    },
    configureServer(server) {
      watchAndRemerge(server, mergeArgs)
    },
  }
}
