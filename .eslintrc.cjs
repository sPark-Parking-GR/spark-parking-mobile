/** @type {import("eslint").Linter.Config} */
module.exports = {
  root: true,
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'prettier',
    'universe/native',
  ],
  plugins: ['@typescript-eslint'],
  parser: '@typescript-eslint/parser',
  rules: {
    // ignoreRestSiblings allows `const { secret, ...rest } = obj` to drop a field on
    // purpose, which is how the tests build invalid payloads.
    '@typescript-eslint/no-unused-vars': [
      'error',
      { argsIgnorePattern: '^_', ignoreRestSiblings: true },
    ],
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
    'no-console': ['warn', { allow: ['warn', 'error'] }],
    // universe/native re-enables prettier-as-a-lint-rule; formatting is owned by
    // standalone prettier scripts, not ESLint.
    'prettier/prettier': 'off',
  },
  ignorePatterns: ['dist/', 'node_modules/', '.turbo/'],
}
