import path from 'node:path';
import process from 'node:process';
import * as tsJest from 'ts-jest';
import { Config } from '@jest/types';

import tsconfig from '../../tsconfig.json';

const IS_BAZEL_TEST = process.env.IS_BAZEL_TEST === 'true';
const REPO_ROOT =
  (IS_BAZEL_TEST ? process.env.PWD : process.env.BUILD_WORKSPACE_DIRECTORY) ||
  path.join(__dirname, '../..');

const testEnvironment = process.env.JEST_ENVIRONMENT || 'jsdom';

const config: Config.InitialOptions = {
  cacheDirectory: '.jestcache',
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
  moduleNameMapper: tsJest.pathsToModuleNameMapper(
    tsconfig.compilerOptions.paths,
    {
      prefix: REPO_ROOT,
      // eslint-disable-next-line vx/gts-identifiers
      useESM: false,
    }
  ),
  modulePathIgnorePatterns: [
    '<rootDir>[/\\\\](build|docs|node_modules|deploy|scripts)[/\\\\]',
  ],
  setupFilesAfterEnv: [
    `${__dirname}/setup_node`,
    testEnvironment === 'jsdom' ? `${__dirname}/setup_dom` : '',
  ].filter(Boolean),
  testEnvironment,
  testMatch: ['<rootDir>/**/?(*.)test.ts?(x)'],
  testPathIgnorePatterns: [
    '.*/node_modules/.*',
    IS_BAZEL_TEST ? '' : '.*/bazel-.+?/.*',
  ].filter(Boolean),
  testTimeout: 10_000,
  transform: IS_BAZEL_TEST
    ? { '^.+\\.[t]sx?$': `${__dirname}/transform.js` }
    : tsJest.createDefaultEsmPreset().transform,
  watchPathIgnorePatterns: ['.*/node_modules/.*', '.*/bazel-.+?/.*'],
  watchPlugins: [
    'jest-watch-typeahead/filename',
    'jest-watch-typeahead/testname',
  ],
};

module.exports = config;
