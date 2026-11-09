import { describe, expect, test } from 'vitest'
import { createRequestSequence } from './requestSequence'

describe('createRequestSequence', () => {
  test('only the latest run is current', () => {
    const sequence = createRequestSequence()
    const first = sequence.start()
    expect(first()).toBe(true)

    const second = sequence.start()
    expect(first()).toBe(false)
    expect(second()).toBe(true)
  })

  test('invalidate makes every running run stale', () => {
    const sequence = createRequestSequence()
    const run = sequence.start()
    sequence.invalidate()
    expect(run()).toBe(false)
  })

  test('a slower earlier request cannot write after a newer one (review F3/F4 scenario)', async () => {
    const sequence = createRequestSequence()
    let shown = ''
    const load = async (value, delayMs) => {
      const isCurrent = sequence.start()
      await new Promise((resolve) => setTimeout(resolve, delayMs))
      if (isCurrent()) shown = value
    }

    await Promise.all([load('unassigned', 30), load('group-b', 5)])

    expect(shown).toBe('group-b')
  })
})
