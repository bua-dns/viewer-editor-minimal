// Shared setup of the admin CLIs (settings:backup, items:dump): loads this repo's .env/.env.local
// into process.env and resolves the config repo with the project folders.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { DEFAULT_PROJECTS_DIR, PROJECTS_DIR_ENV_KEY } from './projectMode.js'

const toolRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

/** Loads the env files once and returns the absolute projects dir. */
export function loadCliEnv() {
  for (const envFile of ['.env', '.env.local']) {
    const fileName = path.join(toolRoot, envFile)
    if (fs.existsSync(fileName)) process.loadEnvFile(fileName)
  }
  return path.resolve(toolRoot, process.env[PROJECTS_DIR_ENV_KEY] || DEFAULT_PROJECTS_DIR)
}
