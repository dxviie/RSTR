import js from '@eslint/js';
import ts from 'typescript-eslint';
import svelte from 'eslint-plugin-svelte';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

/** @type {import('eslint').Linter.Config[]} */
export default [
	js.configs.recommended,
	...ts.configs.recommended,
	...svelte.configs.recommended,
	prettier,
	...svelte.configs.prettier,
	{
		languageOptions: {
			globals: {
				...globals.browser,
				...globals.node
			}
		},
		rules: {
			'@typescript-eslint/no-unused-vars': 'warn',
			'prefer-const': 'warn',
			// Links are plain root-relative hrefs and the app is served from the
			// domain root (no configurable base path), so resolve() adds nothing.
			'svelte/no-navigation-without-resolve': 'off'
		}
	},
	{
		files: ['**/*.svelte', '**/*.svelte.ts', '**/*.svelte.js'],
		languageOptions: {
			parserOptions: {
				parser: ts.parser
			}
		}
	},
	{
		ignores: [
			'build/',
			'.svelte-kit/',
			'dist/',
			'_docs/',
			// The /classic page and the code behind it are kept as a nostalgic
			// snapshot of RSTR's early days. That code is intentionally frozen —
			// we don't lint it, we just keep it running.
			'src/routes/(site)/classic/',
			'src/lib/rstr/',
			'src/lib/ccp/',
			'src/lib/components/RasterCanvas.svelte',
			'src/lib/components/RasterConfig.svelte',
			'src/lib/components/RasterActions.svelte'
		]
	}
];
