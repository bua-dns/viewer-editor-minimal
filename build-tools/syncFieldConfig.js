// CLI: pnpm fields:sync [check|sync <project> --from <collection> --to <collection> --field <key> [--yes]]
// Compares one field between two collections of a project (Strapi schema + viewer field config) and
// makes the target's config identical to the source's. Without arguments in a terminal: a menu.
// Logic: fieldConfigSync.js (pure), fieldSyncStrapi.js (Strapi), fieldSyncMenu.js (menu).
import readline from 'node:readline/promises'
import { parseArgs } from 'node:util'
import { pathToFileURL } from 'node:url'
import { loadCliEnv } from './cliEnv.js'
import { formatReport } from './fieldConfigSync.js'
import { confirmWith, runMenu } from './fieldSyncMenu.js'
import { checkProjectField, loadProjectState, resolveProjectToken, syncProjectField } from './fieldSyncStrapi.js'
import { PROJECTS_DIR_ENV_KEY } from './projectMode.js'
import { listBackupableProjects, TOKEN_ENV_KEY } from './settingsBackup.js'

export const USAGE = `Usage: pnpm fields:sync                     (menu, in a terminal)
       pnpm fields:sync check <project> --from <collection> --to <collection> --field <key>
       pnpm fields:sync sync  <project> --from <collection> --to <collection> --field <key> [--yes]

Collections are the attributes of the project's viewer-setting (e.g. index_cards, collection_items).
check  compares the field's Strapi schema (type, component, repeatable) and its viewer config.
       Exit 0: same structure and identical config; 1: differences; 2: error.
sync   makes the target's field config identical to the source's (order stays per collection;
       prefillWith only if the target has that field). Refused if the Strapi check fails.
       Backs up the viewer-setting first and asks before writing (--yes: don't ask).

Token: ${TOKEN_ENV_KEY} from <project>/.env.local or .env, else this repo's .env.local or the environment.
Optional: ${PROJECTS_DIR_ENV_KEY}.`

const OPTIONS = {
  from: { type: 'string' },
  to: { type: 'string' },
  field: { type: 'string' },
  yes: { type: 'boolean' },
  help: { type: 'boolean', short: 'h' },
}

function parseCommand(argv) {
  const { values, positionals } = parseArgs({ args: argv, allowPositionals: true, options: OPTIONS })
  const [command = '', project = ''] = positionals
  return { command, project, ...values }
}

function missingArguments(args) {
  return ['project', 'from', 'to', 'field'].filter((key) => !args[key])
}

async function runCheck(args, context) {
  const state = await loadProjectState({ ...context, name: args.project })
  const report = checkProjectField(state, args)
  formatReport(report, args).forEach((line) => context.write(line))
  return report.schema.ok && report.identical ? 0 : 1
}

async function runSync(args, context) {
  const confirm = args.yes ? async () => true : context.confirm
  const result = await syncProjectField({ ...context, ...args, name: args.project, confirm })
  context.write(result.message)
  return result.status === 'synced' || result.status === 'unchanged' ? 0 : 1
}

const COMMANDS = { check: runCheck, sync: runSync }

/**
 * Runs one command. `io`: `write(line)`, `confirm(question)`, `projectsDir`, `env`, `fetchImpl`.
 * Returns the exit code.
 */
export async function main(argv, io) {
  let args
  try {
    args = parseCommand(argv)
  } catch (error) {
    io.write(`Error: ${error.message}\n\n${USAGE}`)
    return 2
  }
  const handler = COMMANDS[args.command]
  if (args.help || !handler) {
    io.write(USAGE)
    return args.help ? 0 : 2
  }
  const missing = missingArguments(args)
  if (missing.length) {
    io.write(`Error: missing ${missing.map((key) => (key === 'project' ? '<project>' : `--${key}`)).join(', ')}.\n\n${USAGE}`)
    return 2
  }
  const token = resolveProjectToken(io.projectsDir, args.project, io.env)
  try {
    return await handler(args, { ...io, token })
  } catch (error) {
    io.write(`Error: ${error.message}`)
    return 2
  }
}

// The menu talks on stderr; Ctrl+C exits with 130, Ctrl+D quits quietly.
async function startMenu(projectsDir) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stderr })
  rl.on('SIGINT', () => process.exit(130))
  const closed = new Promise((resolve) => rl.once('close', resolve))
  const ask = (prompt) => Promise.race([rl.question(prompt), closed.then(() => Promise.reject(new Error('closed')))])
  const write = (line) => process.stderr.write(`${line}\n`)
  const io = { write, confirm: (question) => confirmWith(ask, question), projectsDir, env: process.env, fetchImpl: fetch }
  try {
    await runMenu({
      ask,
      write,
      listProjects: () => listBackupableProjects(projectsDir),
      loadState: (name) => loadProjectState({ projectsDir, name, token: resolveProjectToken(projectsDir, name), fetchImpl: fetch }),
      run: (argv) => main(argv, io),
    })
  } catch (error) {
    if (error.message !== 'closed') throw error
  } finally {
    rl.close()
  }
  return 0
}

async function confirmInTerminal(question) {
  if (!process.stdin.isTTY) {
    console.log('Not in a terminal: add --yes to write without asking.')
    return false
  }
  const rl = readline.createInterface({ input: process.stdin, output: process.stderr })
  rl.on('SIGINT', () => process.exit(130))
  try {
    return await confirmWith((prompt) => rl.question(prompt), question)
  } finally {
    rl.close()
  }
}

async function cli() {
  const projectsDir = loadCliEnv()
  const argv = process.argv.slice(2)
  const isTerminal = process.stdin.isTTY && process.stderr.isTTY
  if (!argv.length && isTerminal) return startMenu(projectsDir)
  const io = { write: (line) => console.log(line), confirm: confirmInTerminal, projectsDir, env: process.env, fetchImpl: fetch }
  return main(argv, io)
}

// Run only as a script, not when imported (tests, other tools).
const isScript = Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href
if (isScript) process.exitCode = await cli()
