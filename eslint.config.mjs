import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';

export default [
  {
    ignores: ['**/dist/**', '**/node_modules/**', '**/coverage/**', '**/*.d.ts'],
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
  {
    // apps/web: colours and type come from the design tokens (index.css, tailwind.config).
    files: ['apps/web/src/**/*.tsx', 'apps/web/src/**/*.ts'],
    ignores: ['**/__tests__/**', '**/*.spec.ts', '**/*.spec.tsx'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector:
            'Literal[value=/\\b(bg|text|border|ring|from|to|via|fill|stroke|outline|divide)-(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\\d{2,3}\\b/], TemplateElement[value.raw=/\\b(bg|text|border|ring|from|to|via|fill|stroke|outline|divide)-(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\\d{2,3}\\b/]',
          message: 'Use a design token (primary, success, warning, destructive, muted) instead of a raw palette colour.',
        },
        {
          selector:
            'Literal[value=/\\b(text|bg|border)-\\[#[0-9a-fA-F]{3,8}\\]/], TemplateElement[value.raw=/\\b(text|bg|border)-\\[#[0-9a-fA-F]{3,8}\\]/]',
          message: 'Use a design token instead of a hex colour class.',
        },
        {
          selector: 'Literal[value=/\\btext-\\[\\d+(\\.\\d+)?px\\]/], TemplateElement[value.raw=/\\btext-\\[\\d+(\\.\\d+)?px\\]/]',
          message: 'Use the type scale (text-2xs, text-xs, text-sm, ...) instead of a pixel font size.',
        },
      ],
    },
  },
];
