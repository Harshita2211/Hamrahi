module.exports = {
  root: true,
  env: {
    node: true,
    es2021: true,
  },
  extends: ['eslint:recommended', 'plugin:node/recommended', 'prettier'],
  parserOptions: {
    ecmaVersion: 2021,
    sourceType: 'module',
  },
  rules: {
    'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    'no-console': 'off',
    'node/no-unsupported-features/es-syntax': 'off',
    'node/no-unsupported-features/es-builtins': 'off'
    , 'node/no-unsupported-features/node-builtins': 'off'
  },
  overrides: [
    {
      files: ['public/js/**'],
      env: {
        browser: true,
        es2021: true
      },
      globals: {
        L: 'readonly',
        initializeApp: 'readonly',
        google: 'readonly'
      },
      rules: {
        'no-undef': 'off'
      }
    },
    {
      files: ['scripts/**'],
      env: { node: true },
      rules: {
        'node/shebang': 'off'
      }
    }
  ]
};

