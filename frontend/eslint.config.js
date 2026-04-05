/**
 * ESLint + TypeScript alignment:
 * - Run `npm run typecheck` before pushing — same TypeScript program as the first step of `npm run build` (`tsc -b`).
 * - ESLint uses typescript-eslint `recommended` (syntax-based). Stricter type-aware rules need
 *   `parserOptions.projectService: true` plus e.g. `tseslint.configs.strictTypeChecked`; that is not enabled here yet.
 */
import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
  },
])
