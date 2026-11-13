import { describe, expect, test, vi } from 'vitest'
import { confirmWith, runMenu } from './fieldSyncMenu.js'
import { main, USAGE } from './syncFieldConfig.js'

const reference = { type: 'component', component: 'metadata-forms.wikidata-reference', repeatable: true }
const state = {
  data: {
    index_cards: { itemsPath: '/api/index-cards', fields: { label: { order: 0 }, collectors: { order: 9 } } },
    collection_items: { itemsPath: '/api/collection-items', fields: { collectors: { order: 6 } } },
  },
  collections: [
    { id: 'index_cards', itemsPath: '/api/index-cards', fieldCount: 2 },
    { id: 'collection_items', itemsPath: '/api/collection-items', fieldCount: 1 },
  ],
  contentTypes: { data: [{ schema: { pluralName: 'index-cards', attributes: { collectors: reference } } }] },
}

// Plays a session: each prompt takes the next scripted answer; running out of answers quits.
function session(answers) {
  const queue = [...answers]
  const prompts = []
  const lines = []
  const io = {
    ask: vi.fn(async (prompt) => {
      prompts.push(prompt)
      return queue.length ? queue.shift() : 'q'
    }),
    write: (line) => lines.push(line),
    listProjects: () => ['xylothek-collection-itmes', 'xylothek-index-cards'],
    loadState: vi.fn(async () => state),
    run: vi.fn(async () => 0),
  }
  return { io, prompts, lines, done: runMenu(io) }
}

describe('menu', () => {
  test('Enter takes the defaults; the run gets the CLI argv; then it returns to the field choice', async () => {
    const { io, lines, prompts, done } = session(['2', '', '', '', '', 'q'])
    await done

    expect(io.loadState).toHaveBeenCalledWith('xylothek-index-cards')
    expect(io.run).toHaveBeenCalledWith(['check', 'xylothek-index-cards', '--from', 'index_cards', '--to', 'collection_items', '--field', 'collectors'])
    expect(lines).toContain('  1) collectors  (component, configured in target)  (default)')
    expect(lines).toContain('  2) label  (field, not in target)')
    expect(lines).toContain('> pnpm fields:sync check xylothek-index-cards --from index_cards --to collection_items --field collectors')
    expect(prompts.at(-1)).toBe('Choice [1] (b back, q quit): ')
    expect(lines.filter((line) => line === 'Field:')).toHaveLength(2)
  })

  test('the target list leaves out the source; b goes back; sync reloads the record', async () => {
    const { io, lines, done } = session(['2', '2', 'b', '1', '', '', '2', 'q'])
    await done

    const targetLists = lines.filter((line) => line === 'Target collection:')
    expect(targetLists).toHaveLength(2)
    expect(lines).toContain('  1) index_cards  (/api/index-cards, 2 fields)  (default)')
    expect(io.run).toHaveBeenCalledWith(expect.arrayContaining(['sync', '--from', 'index_cards']))
    expect(io.loadState).toHaveBeenCalledTimes(2)
  })

  test('asks again on bad input and says what is valid', async () => {
    const { lines, done } = session(['7', 'x', 'q'])
    await done
    expect(lines.filter((line) => line === 'Please enter a number from 1 to 2, b or q.')).toHaveLength(2)
  })

  test('shows a failing load and returns to the project choice', async () => {
    const { io, lines, done } = session(['1', 'q'])
    io.loadState.mockRejectedValueOnce(new Error('GET failed: HTTP 500.'))
    await done
    expect(lines).toContain('Error: GET failed: HTTP 500.')
  })

  test('confirm defaults to no', async () => {
    expect(await confirmWith(async () => '', 'Write?')).toBe(false)
    expect(await confirmWith(async () => 'Y', 'Write?')).toBe(true)
  })
})

describe('CLI main', () => {
  function io() {
    const lines = []
    return { lines, write: (line) => lines.push(line), confirm: async () => false, projectsDir: '/nowhere', env: {}, fetchImpl: vi.fn() }
  }

  test('prints the usage for --help (0) and an unknown command (2)', async () => {
    const help = io()
    expect(await main(['--help'], help)).toBe(0)
    expect(help.lines).toEqual([USAGE])
    expect(await main(['merge'], io())).toBe(2)
  })

  test('names missing arguments', async () => {
    const out = io()
    expect(await main(['check', 'xyl', '--from', 'index_cards'], out)).toBe(2)
    expect(out.lines[0]).toMatch(/^Error: missing --to, --field\./)
  })

  test('reports a failing command as an error with exit 2', async () => {
    const out = io()
    expect(await main(['check', 'xyl', '--from', 'a', '--to', 'b', '--field', 'c'], out)).toBe(2)
    expect(out.lines[0]).toMatch(/^Error: .*not found/)
  })
})
