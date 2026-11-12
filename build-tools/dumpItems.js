// CLI: pnpm items:dump <project...> | --all [--collection /api/<name>] [--page-size n]
// Saves every item of each project's Strapi collection into
// <projectsDir>/<project>/item-dumps/<collection>/<fetch time>/. See build-tools/itemsDump.js.
import path from 'node:path'
import { parseArgs } from 'node:util'
import { loadCliEnv } from './cliEnv.js'
import { PROJECTS_DIR_ENV_KEY } from './projectMode.js'
import { listBackupableProjects, TOKEN_ENV_KEY } from './settingsBackup.js'
import { DEFAULT_PAGE_SIZE, dumpProject } from './itemsDump.js'

const USAGE = `Usage: pnpm items:dump <project...> [--collection /api/<name>] [--page-size n]
       pnpm items:dump --all

Saves every item of the project's Strapi collection, unchanged, as
<projectsDir>/<project>/item-dumps/<collection>/<fetch time>/items.json, plus _meta.json.
The collection is the viewer-setting's itemsPath unless --collection is given.
Page size defaults to ${DEFAULT_PAGE_SIZE}.

Optional (env or .env.local): ${PROJECTS_DIR_ENV_KEY}, ${TOKEN_ENV_KEY} (Strapi JWT or API token).`

const projectsDir = loadCliEnv()

function parsePageSize(value) {
  if (value === undefined) return DEFAULT_PAGE_SIZE
  const pageSize = Number(value)
  if (!Number.isInteger(pageSize) || pageSize < 1) throw new Error(`--page-size must be a positive integer, got "${value}".`)
  return pageSize
}

function showProgress(name) {
  return (page, pageCount) => process.stdout.write(`\r  ${name}: page ${page}/${pageCount}`)
}

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      all: { type: 'boolean' },
      collection: { type: 'string' },
      'page-size': { type: 'string' },
      help: { type: 'boolean', short: 'h' },
    },
  })
  const names = values.all ? listBackupableProjects(projectsDir) : positionals
  if (values.help || !names.length) {
    console.log(USAGE)
    console.log(`\nProjects with a basic config in ${projectsDir}: ${listBackupableProjects(projectsDir).join(', ') || 'none'}`)
    return values.help ? 0 : 1
  }

  const options = { collection: values.collection || '', pageSize: parsePageSize(values['page-size']) }
  const failures = await dumpAll(names, { ...options, token: process.env[TOKEN_ENV_KEY] || '' })
  return failures ? 1 : 0
}

// One line per project; a failing project does not stop the others. Returns the failure count.
async function dumpAll(names, options) {
  let failures = 0
  for (const name of names) {
    try {
      const result = await dumpProject({ projectsDir, name, ...options, onPage: showProgress(name) })
      process.stdout.write('\n')
      console.log(`saved  ${name}: ${result.count} items → ${path.relative(projectsDir, result.dir)}  (${result.source})`)
    } catch (error) {
      failures += 1
      process.stdout.write('\n')
      console.error(`failed ${name}: ${error.message}`)
    }
  }
  return failures
}

process.exitCode = await main()
