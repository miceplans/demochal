// @ts-check
const tseslint = require('typescript-eslint');

/** Shared base ESLint flat config, extended by front/ and server/ */
module.exports = tseslint.config(
  {
    ignores: ['dist/**', '.next/**', 'node_modules/**', 'build/**'],
  },
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
);
