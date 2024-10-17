import path from 'node:path';
import process from 'node:process';
import * as tsJest from 'ts-jest';
import { Config } from '@jest/types';

import tsconfig from '../../tsconfig.json';

const IS_BAZEL_TEST = process.env.IS_BAZEL_TEST === 'true';
const REPO_ROOT = IS_BAZEL_TEST
  ? process.env.PWD
  : path.join(__dirname, '../..');

const testEnvironment = process.env.JEST_ENVIRONMENT || 'jsdom';

module.exports = {
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
      useESM: false,
    }
  ),
  modulePathIgnorePatterns: [
    '<rootDir>[/\\\\](build|docs|node_modules|deploy|scripts)[/\\\\]',
  ],
  reporters: ['jest-junit', 'default'],
  setupFilesAfterEnv: [
    `${__dirname}/setup_node`,
    testEnvironment === 'jsdom' && `${__dirname}/setup_dom`,
  ].filter(Boolean),
  testEnvironment,
  testMatch: ['<rootDir>/**/?(*.)test.ts?(x)'],
  testTimeout: 10_000,
  transform: IS_BAZEL_TEST
    ? { '^.+\\.[t]sx?$': `${__dirname}/transform.js` }
    : tsJest.createDefaultPreset().transform,
  watchPathIgnorePatterns: ['.*/node_modules/.*'],
  watchPlugins: [
    'jest-watch-typeahead/filename',
    'jest-watch-typeahead/testname',
  ],
} as Config.InitialOptions;
