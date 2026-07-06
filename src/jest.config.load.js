/**
 * jest.config.load.js
 *
 * Dedicated Jest configuration for load and performance benchmarks.
 *
 * Run with:   npm run test:load
 *
 * These suites are intentionally excluded from the default `jest` run because they:
 *   - Simulate concurrent async workloads (setTimeout races, Promise.allSettled batches)
 *   - Take 20–30 seconds each to complete
 *   - Are benchmarks/documentation rather than correctness assertions
 *   - Should run in a dedicated CI step or on-demand, not on every push
 */

const nextJest = require('next/jest');

const createJestConfig = nextJest({ dir: './' });

/** @type {import('jest').Config} */
const customConfig = {
  testEnvironment: 'jest-environment-node',
  testMatch: ['**/__tests__/load/**/*.test.ts'],
  testTimeout: 60000,
  setupFiles: ['<rootDir>/jest.setup-env.js'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
};

module.exports = createJestConfig(customConfig);
