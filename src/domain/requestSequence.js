/**
 * "Latest request wins" for async work that writes shared state. `start()` begins a new run and
 * returns `isCurrent()`, which turns false as soon as a newer run starts. Check it after every
 * `await` before writing anything; `invalidate()` makes all running work stale without a new run.
 */
export function createRequestSequence() {
  let currentRun = 0

  function start() {
    currentRun += 1
    const run = currentRun
    return () => run === currentRun
  }

  function invalidate() {
    currentRun += 1
  }

  return { start, invalidate }
}
