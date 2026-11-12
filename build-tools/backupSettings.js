// CLI: pnpm settings:backup <project...> | --all
// Saves every attribute of each project's Strapi viewer-setting into
// <projectsDir>/<project>/settings-backups/<updatedAt>/. See build-tools/settingsBackup.js.
import path from 'node:path'
import { parseArgs } from 'node:util'
import { loadCliEnv } from './cliEnv.js'
import { PROJECTS_DIR_ENV_KEY } from './projectMode.js'
import { backupProject, listBackupableProjects, TOKEN_ENV_KEY } from './settingsBackup.js'

const USAGE = `Usage: pnpm settings:backup <project...>
       pnpm settings:backup --all

Saves every attribute of each project's viewer-setting (settings, wording, mappings, ...)
as one file each into <projectsDir>/<project>/settings-backups/<updatedAt>/, plus _meta.json.
A folder is only written when the setting has changed since the last backup.

Optional (env or .env.local): ${PROJECTS_DIR_ENV_KEY}, ${TOKEN_ENV_KEY} (Strapi JWT or API token).`

const projectsDir = loadCliEnv()

function resolveProjectNames({ values, positionals }) {
  if (values.all) return listBackupableProjects(projectsDir)
  return positionals
}

async function main() {
  const args = parseArgs({
    allowPositionals: true,
    options: { all: { type: 'boolean' }, help: { type: 'boolean', short: 'h' } },
  })
  const names = resolveProjectNames(args)
  if (args.values.help || !names.length) {
    console.log(USAGE)
    console.log(`\nProjects with a basic config in ${projectsDir}: ${listBackupableProjects(projectsDir).join(', ') || 'none'}`)
    return args.values.help ? 0 : 1
  }

  const failures = await backupAll(names, process.env[TOKEN_ENV_KEY] || '')
  return failures ? 1 : 0
}

// One line per project; a failing project does not stop the others. Returns the failure count.
async function backupAll(names, token) {
  let failures = 0
  for (const name of names) {
    try {
      const result = await backupProject({ projectsDir, name, token })
      const state = result.written ? 'saved    ' : 'unchanged'
      const files = result.files.length ? `  [${result.files.join(', ')}]` : ''
      console.log(`${state} ${name}: ${path.relative(projectsDir, result.dir)}${files}  (${result.url})`)
    } catch (error) {
      failures += 1
      console.error(`failed    ${name}: ${error.message}`)
    }
  }
  return failures
}

process.exitCode = await main()
