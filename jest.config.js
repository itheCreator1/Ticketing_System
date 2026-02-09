module.exports = {
  testEnvironment: 'node',
  setupFiles: ['<rootDir>/tests/setupEnv.js'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  testMatch: ['**/tests/**/*.test.js'],
  collectCoverageFrom: [
    'models/**/*.js',
    'services/**/*.js',
    'routes/**/*.js',
    'middleware/**/*.js',
    'utils/**/*.js',
    'validators/**/*.js',
    '!**/node_modules/**',
    '!**/tests/**',
  ],
  coverageThreshold: {
    global: {
      branches: 60,
      functions: 60,
      lines: 60,
      statements: 60,
    },
  },
  testTimeout: 10000,
  verbose: true,
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
};
