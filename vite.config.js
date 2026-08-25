import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  // base: '/viewer-editor/',
  // base: '/mstub-referencer/',
  base: '/viewer-editor-strapi/',
  plugins: [vue()],
})
