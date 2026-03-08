module.exports = {
  root: true,
  env: {
    es2022: true,
    browser: true,
    node: true,
  },
  parser: 'vue-eslint-parser',
  parserOptions: {
    parser: '@typescript-eslint/parser',
    ecmaVersion: 'latest',
    sourceType: 'module',
    extraFileExtensions: ['.vue'],
  },
  extends: [
    'eslint:recommended',
    'plugin:vue/vue3-recommended',
    'plugin:@typescript-eslint/recommended',
  ],
  ignorePatterns: [
    '**/node_modules/**',
    '**/dist/**',
    'packages/**/dist/**',
    'ai_team/**',
  ],
  rules: {
    'no-empty': ['error', {
      allowEmptyCatch: true,
    }],
    'no-console': 'off',
    'vue/multi-word-component-names': 'off',
    'vue/no-v-html': 'off',
    'vue/max-attributes-per-line': 'off',
    'vue/singleline-html-element-content-newline': 'off',
    'vue/multiline-html-element-content-newline': 'off',
    '@typescript-eslint/ban-types': 'off',
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/ban-ts-comment': 'off',
    '@typescript-eslint/no-unused-vars': 'off',
  },
  overrides: [
    {
      files: ['packages/server/**/*.ts'],
      env: {
        node: true,
        browser: false,
      },
    },
    {
      files: ['packages/client/**/*.{ts,vue}'],
      env: {
        browser: true,
        node: false,
      },
    },
  ],
}
