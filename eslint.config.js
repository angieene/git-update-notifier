// @ts-check
const tseslint = require('@typescript-eslint/eslint-plugin');
const tsparser = require('@typescript-eslint/parser');

/** @type {import('eslint').Linter.FlatConfig[]} */
module.exports = [
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        project: './tsconfig.json',
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
    },
    rules: {
      ...tseslint.configs['recommended'].rules,
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/explicit-function-return-type': ['error', { allowExpressions: true }],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],

      // Enforce hexagonal architecture boundaries:
      // domain/ and application/ must NOT import from infrastructure/
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/infrastructure/**'],
              message:
                'Domain and application layers must not import from infrastructure. Define a port interface instead.',
            },
          ],
        },
      ],
    },
  },
  {
    // Infrastructure is allowed to import anywhere
    files: ['src/infrastructure/**/*.ts', 'src/main.ts', 'src/config.ts'],
    rules: {
      'no-restricted-imports': 'off',
    },
  },
  {
    files: ['src/**/*.ts'],
    ignores: ['src/infrastructure/**', 'src/main.ts', 'src/config.ts'],
  },
];
