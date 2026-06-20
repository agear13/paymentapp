const nextJest = require('next/jest');

const createJestConfig = nextJest({ dir: './' });

// Inline Babel config for Jest transforms.
// Defined here (not in babel.config.js) so Next.js never discovers it and
// continues to use SWC for the production build (required by next/font).
const BABEL_CONFIG = {
  presets: [
    [
      'next/babel',
      {
        'preset-env': { targets: { node: 'current' } },
      },
    ],
  ],
};

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
  // Use babel-jest with inline config so Next.js keeps SWC (needed for next/font).
  transform: {
    '^.+\\.(js|jsx|ts|tsx|mjs)$': ['babel-jest', BABEL_CONFIG],
  },
  moduleNameMapper: {
    // Path alias resolution: @/ → src/
    '^@/(.*)$': '<rootDir>/$1',
    // Silence static asset imports that are not relevant in tests
    '^.+\\.(css|scss|sass|png|jpg|jpeg|gif|svg|ico|webp|avif)$':
      '<rootDir>/__mocks__/fileMock.js',
  },
  transformIgnorePatterns: [
    '/node_modules/(?!(server-only)/)',
  ],
};

module.exports = createJestConfig(customConfig);
