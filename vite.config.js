import path from 'node:path'
import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import { mergePublicDirs, projectModePlugin, resolveProject } from './build-tools/projectMode.js'

// Without --mode <project>: the generic build. With it: see build-tools/projectMode.js.
export default defineConfig(({ mode }) => {
  const root = process.cwd()
  const project = resolveProject({ mode, root, env: loadEnv(mode, root, 'VIEWER_EDITOR_') })

  if (!project) {
    return {
      base: '/viewer-editor/',
      plugins: [vue()],
    }
  }

  const mergeArgs = {
    genericDir: path.join(root, 'public'),
    projectDir: project.publicDir,
    targetDir: project.mergedPublicDir,
  }
  mergePublicDirs(mergeArgs)

  return {
    base: project.base,
    envDir: project.dir,
    publicDir: project.mergedPublicDir,
    build: { outDir: project.outDir, emptyOutDir: true },
    plugins: [vue(), projectModePlugin(project, mergeArgs)],
  }
})
