// Lint for app, admin scripts and tests. `pnpm lint` runs it; CI runs it before the tests.
// The Vue rules catch reactivity and template mistakes mechanically (destructured props,
// side effects in computed, mutated props, missing keys).
import js from '@eslint/js'
import pluginVue from 'eslint-plugin-vue'
import globals from 'globals'

export default [
  {
    ignores: ['dist/**', 'dist-projects/**', 'node_modules/**', 'public/**', 'sample-data/**', '_INTERN/**'],
  },
  js.configs.recommended,
  ...pluginVue.configs['flat/recommended'],
  {
    files: ['src/**/*.{js,vue}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.browser },
    },
  },
  {
    files: ['build-tools/**/*.js', 'vite.config.js', 'eslint.config.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.node },
    },
  },
  {
    files: ['**/*.test.js', 'test/**/*.js'],
    languageOptions: {
      globals: { ...globals.node, ...globals.browser },
    },
  },
  {
    rules: {
      // Template formatting is not enforced: the SFCs use their own wrapping, and a mass reformat
      // would bury real changes in the history.
      'vue/max-attributes-per-line': 'off',
      'vue/singleline-html-element-content-newline': 'off',
      'vue/multiline-html-element-content-newline': 'off',
      'vue/html-self-closing': 'off',
      'vue/html-indent': 'off',
      'vue/html-closing-bracket-newline': 'off',
      'vue/first-attribute-linebreak': 'off',
      'vue/attributes-order': 'off',
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' }],
    },
  },
  {
    // `footer/Identity.vue` is namespaced by its folder; renaming it is churn without benefit.
    files: ['src/components/footer/**/*.vue'],
    rules: { 'vue/multi-word-component-names': 'off' },
  },
]
