// Interactive menu of `pnpm fields:sync`: project → source → target → field → operation, then the
// result and back to the field choice. Every run is a CLI argv handed to `run`, so anything the menu
// does can be typed. All I/O is injected: `ask(prompt)` (resolves to the typed line), `write(line)`,
// `listProjects()`, `loadState(project)` and `run(argv)`.
import { listFieldChoices, findSchemaAttributes } from './fieldConfigSync.js'

export const BACK = Symbol('back')
export const QUIT = Symbol('quit')

/** Numbered choice; Enter takes the default, `b` goes back, `q` quits; anything else is asked again. */
export async function choose({ ask, write }, { title, options, defaultIndex = 0 }) {
  write('')
  write(title)
  options.forEach((option, index) => write(`  ${index + 1}) ${option.label}${index === defaultIndex ? '  (default)' : ''}`))
  for (;;) {
    const answer = (await ask(`Choice [${defaultIndex + 1}] (b back, q quit): `)).trim().toLowerCase()
    if (answer === '') return options[defaultIndex].value
    if (answer === 'b') return BACK
    if (answer === 'q') return QUIT
    const index = Number(answer) - 1
    if (Number.isInteger(index) && options[index]) return options[index].value
    write(`Please enter a number from 1 to ${options.length}, b or q.`)
  }
}

/** y/N question; only `y` / `yes` confirms. */
export async function confirmWith(ask, question) {
  const answer = (await ask(`${question} [y/N] `)).trim().toLowerCase()
  return answer === 'y' || answer === 'yes'
}

function fieldLabel(choice) {
  const kind = choice.isComponent ? 'component' : 'field'
  return `${choice.key}  (${kind}, ${choice.inTarget ? 'configured in target' : 'not in target'})`
}

function collectionOptions(collections, exclude = '') {
  return collections
    .filter((entry) => entry.id !== exclude)
    .map((entry) => ({ label: `${entry.id}  (${entry.itemsPath}, ${entry.fieldCount} fields)`, value: entry.id }))
}

const OPERATIONS = [
  { label: 'check  (read only)', value: 'check' },
  { label: 'sync   (writes the target config after a backup and a confirmation)', value: 'sync' },
]

// One prompt per step; each returns the value, BACK or QUIT. `session` collects the choices.
const STEPS = [
  async (io, session) => {
    const projects = io.listProjects()
    if (!projects.length) throw new Error('No projects with a basic config found.')
    const value = await choose(io, {
      title: 'Project:',
      options: projects.map((name) => ({ label: name, value: name })),
      defaultIndex: Math.max(0, projects.indexOf(session.project)),
    })
    if (typeof value === 'string') {
      io.write(`Loading ${value} …`)
      session.state = await io.loadState(value)
      session.project = value
    }
    return value
  },
  async (io, session) => {
    const options = collectionOptions(session.state.collections)
    if (!options.length) throw new Error('This viewer-setting has no collection attributes (itemsPath + fields).')
    const value = await choose(io, { title: 'Source collection:', options, defaultIndex: indexOf(options, session.from) })
    if (typeof value === 'string') session.from = value
    return value
  },
  async (io, session) => {
    const options = collectionOptions(session.state.collections, session.from)
    if (!options.length) throw new Error('There is no other collection to sync into.')
    const value = await choose(io, { title: 'Target collection:', options, defaultIndex: indexOf(options, session.to) })
    if (typeof value === 'string') session.to = value
    return value
  },
  async (io, session) => {
    const { data, contentTypes } = session.state
    const sourceAttributes = findSchemaAttributes(contentTypes, data[session.from].itemsPath) || {}
    const choices = listFieldChoices(data[session.from], data[session.to], sourceAttributes)
    const options = choices.map((choice) => ({ label: fieldLabel(choice), value: choice.key }))
    if (!options.length) throw new Error(`${session.from} configures no fields.`)
    const value = await choose(io, { title: 'Field:', options, defaultIndex: indexOf(options, session.field) })
    if (typeof value === 'string') session.field = value
    return value
  },
  async (io, session) => {
    const value = await choose(io, { title: `Operation for "${session.field}":`, options: OPERATIONS })
    if (typeof value !== 'string') return value
    const argv = [value, session.project, '--from', session.from, '--to', session.to, '--field', session.field]
    io.write('')
    io.write(`> pnpm fields:sync ${argv.join(' ')}`)
    await io.run(argv)
    // A sync changed the record: reload it so the next choices and checks see the new state.
    if (value === 'sync') session.state = await io.loadState(session.project)
    return BACK
  },
]

function indexOf(options, value) {
  return Math.max(0, options.findIndex((option) => option.value === value))
}

/** Runs the menu until `q` (or `b` on the first step). Step errors are shown, then the step is asked again. */
export async function runMenu(io) {
  const session = { project: '', state: null, from: '', to: '', field: '' }
  let step = 0
  while (step >= 0) {
    let result
    try {
      result = await STEPS[step](io, session)
    } catch (error) {
      io.write(`Error: ${error.message}`)
      result = BACK
    }
    if (result === QUIT) return
    step = result === BACK ? step - 1 : step + 1
  }
}
