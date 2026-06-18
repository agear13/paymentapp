const nextJest = require('next/jest');

const createJestConfig = nextJest({ dir: './' });

/** @type {import('jest').Config} */
const customConfig = {
  testEnvironment: 'jest-environment-node',
  testMatch: ['**/__tests__/**/*.test.ts', '**/__tests__/**/*.test.tsx'],
  modulePathIgnorePatterns: ['<rootDir>/e2e/'],
  // Exclude suites that run under their own dedicated config:
  //   test:load  → jest.config.load.js (slow, async-heavy, 20–30s each)
  testPathIgnorePatterns: [
    '/node_modules/',
    '<rootDir>/__tests__/load/',
  ],
  setupFiles: ['<rootDir>/jest.setup-env.js'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
};

module.exports = createJestConfig(customConfig);
