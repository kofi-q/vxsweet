import process from 'node:process';
import { Config } from '@jest/types';

const IS_BAZEL_TEST = process.env.IS_BAZEL_TEST === 'true';

const testEnvironment = process.env.JEST_ENVIRONMENT || 'jsdom';

const config: Config.InitialOptions = {
  clearMocks: true,
  // TODO: Enable coverage
  // collectCoverage: true,
  // collectCoverageFrom: [
  //   '**/*.{ts,tsx}',
  //   '!**/*.stories.{ts,tsx}',
  //   '!**/*.test.{ts,tsx}',
  // ],
  // coverageReporters: ['json', 'lcov'],
  // coverageThreshold: {
  //   global: {
  //     statements: 100,
  //     branches: 100,
  //     lines: 100,
  //     functions: 100,
  //   },
  // },
  moduleFileExtensions: ['js', 'node', 'mjs', 'json'],
  passWithNoTests: true,
  sandboxInjectedGlobals: ['Math'],
  setupFilesAfterEnv: [
    `${__dirname}/setup_node`,
    testEnvironment === 'jsdom' ? `${__dirname}/setup_dom` : '',
  ].filter(Boolean),
  testEnvironment,
  testMatch: ['<rootDir>/**/?(*.)test.js'],
  testPathIgnorePatterns: [
    '.*/node_modules/.*',
    IS_BAZEL_TEST ? '' : '.*/bazel-.+?/.*',
  ].filter(Boolean),
  testTimeout: 10_000,
  transform: {},
  watchPathIgnorePatterns: ['.*/node_modules/.*', '.*/bazel-.+?/.*'],
  watchPlugins: [
    'jest-watch-typeahead/filename',
    'jest-watch-typeahead/testname',
  ],
};

module.exports = config;
