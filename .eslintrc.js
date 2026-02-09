module.exports = {
  env: {
    node: true,
    es2021: true,
    jest: true,
  },
  extends: [
    'eslint:recommended',
    'prettier', // Disables ESLint rules that conflict with Prettier
  ],
  parserOptions: {
    ecmaVersion: 2021,
    sourceType: 'commonjs',
  },
  rules: {
    // Code Quality
    'no-unused-vars': [
      'error',
      {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
      },
    ],
    'no-console': ['warn', { allow: ['warn', 'error'] }],
    'no-debugger': 'error',
    'no-eval': 'error',
    'no-implied-eval': 'error',
    'no-with': 'error',
    'prefer-const': 'error',
    'no-var': 'error',

    // Security
    'no-new-func': 'error',
    'no-return-await': 'error',

    // Best Practices
    eqeqeq: ['error', 'always'],
    curly: ['error', 'all'],
    'brace-style': ['error', '1tbs'],
    'no-throw-literal': 'error',
    'prefer-promise-reject-errors': 'error',
    'no-async-promise-executor': 'error',

    // Style — formatting rules (indent, quotes, semi, comma-dangle,
    // trailing-spaces, eol-last) are handled by Prettier via
    // eslint-config-prettier. Do not re-declare them here.

    // Node.js specific
    'no-path-concat': 'error',
    'handle-callback-err': 'error',
    'no-sync': ['warn', { allowAtRootLevel: true }],
  },
  overrides: [
    {
      // Test files can use console and have more relaxed unused var rules
      files: ['tests/**/*.js', 'scripts/**/*.js'],
      rules: {
        'no-console': 'off',
        'no-unused-vars': 'warn', // Downgrade to warning for test files
        'no-return-await': 'warn', // Downgrade to warning
      },
    },
    {
      // Client-side JavaScript files need browser globals
      files: ['public/js/**/*.js'],
      env: {
        browser: true,
        node: false,
      },
    },
  ],
  ignorePatterns: ['node_modules/', 'coverage/', 'dist/', 'build/', '*.min.js'],
};
