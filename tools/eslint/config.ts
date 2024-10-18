import globals from 'globals';
import { Linter } from 'eslint';
import eslintJs from '@eslint/js';
import { AST_NODE_TYPES } from '@typescript-eslint/utils';
import * as tsParser from '@typescript-eslint/parser';

import pluginA11y from 'eslint-plugin-jsx-a11y';
// @ts-expect-error - no types available
import * as pluginImports from 'eslint-plugin-import';
// @ts-expect-error - no types available
import pluginJest from 'eslint-plugin-jest';
import pluginNode from 'eslint-plugin-n';
import pluginReact from 'eslint-plugin-react';
// @ts-expect-error - no types available
import * as pluginReactHooks from 'eslint-plugin-react-hooks';
import pluginTs from 'typescript-eslint';
import prettierRecommended from 'eslint-plugin-prettier/recommended';

import { pluginVx } from '../../libs/eslint-plugin-vx/src';

const jsExtensions = ['.js', '.jsx'];
const tsExtensions = ['.ts', '.tsx'];
const allExtensions = jsExtensions.concat(tsExtensions);

module.exports = [
  pluginImports.flatConfigs.errors,
  pluginImports.flatConfigs.warnings,
  eslintJs.configs.recommended,
  pluginReact.configs.flat.recommended,
  pluginReact.configs.flat['jsx-runtime'],
  pluginA11y.flatConfigs.recommended,
  ...pluginTs.configs.recommended,
  prettierRecommended,

  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
      // eslint-disable-next-line vx/gts-direct-module-export-access-only
      parser: tsParser,
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
        ecmaVersion: 'latest',
        project: ['./tsconfig.json'],
        sourceType: 'module',
      },
    },
  },

  {
    ignores: [
      '*.csv.ts',
      '*.d.ts',
      '*.jpeg.ts',
      '*.json.ts',
      '*.jsonl.ts',
      '*.txt.ts',
      '*.zip.ts',
      '**/.pnpmfile.cjs',
      '**/.prettierrc.mjs',
      '**/.stylelintrc.js',
      '**/.stylelintrc-css.js',
      '**/build',
      '**/coverage',
      '**/docs',
      '**/gazelle/js/**',
      '**/libs/eslint-plugin-vx/tests/fixtures/',
      '**/node_modules/**',
      '**/public',
      '**/tests-examples/',
      'bazel-*/',
      'eslint.config.mjs',
    ],
  },

  {
    settings: {
      'import/extensions': allExtensions,
      'import/parsers': {
        '@typescript-eslint/parser': tsExtensions,
      },
      'import/resolver': {
        typescript: {
          alwaysTryTypes: true,
          project: ['./tsconfig.json'],
        },
        node: {
          extensions: allExtensions,
        },
      },
    },
    plugins: {
      n: pluginNode,
      vx: pluginVx,
    },
    rules: {
      'jsx-a11y/html-has-lang': 'off',
      'n/prefer-node-protocol': 'error',
      // Enforce various custom lint rules to follow the recommendations of the Google TypeScript Style Guide.
      // See libs/eslint-plugin-vx/docs for more documentation on individual rules.
      'vx/gts-array-type-style': 'error',
      'vx/gts-constants': 'error',
      'vx/gts-direct-module-export-access-only': 'error',
      'vx/gts-func-style': 'error',
      'vx/gts-identifiers': [
        'error',
        {
          allowedNames: [
            ...Object.keys(AST_NODE_TYPES),
            '/.*(X|Y)Offset/',
            '/buildCVR.*/',
            '/CVR.*/',
            '/CVR.*/',
            '$id',
            '$ref',
            '$schema',
            'baseURL',
            'getURL',
            'HStack',
            'setXScaleValue',
            'setYScaleValue',
            'toJSON',
            'toPNG',
            'VStack',
          ],
        },
      ],
      'vx/gts-module-snake-case': 'error',
      'vx/gts-no-array-constructor': 'error',
      'vx/gts-no-const-enum': 'error',
      'vx/gts-no-default-exports': 'error',
      'vx/gts-no-foreach': 'error',
      'vx/gts-no-for-in-loop': 'error',
      // Importing types allows a package to list another package as a dev
      // dependency if only using the package's types. This makes it possible for
      // browser-based packages to import types from Node-based packages.
      'vx/gts-no-import-export-type': 'off',
      'vx/gts-no-private-fields': 'error',
      'vx/gts-no-public-class-fields': 'error',
      'vx/gts-no-public-modifier': 'error',
      'vx/gts-no-unnecessary-has-own-property-check': 'warn',
      'vx/gts-object-literal-types': 'error',
      'vx/gts-parameter-properties': 'error',
      'vx/gts-safe-number-parse': 'error',
      'vx/gts-spread-like-types': 'error',
      'vx/gts-type-parameters': 'error',
      'vx/gts-unicode-escapes': 'error',
      'vx/gts-use-optionals': 'error',

      // Enable various quality of life custom rules that increase readability and prevent bugs.
      // See libs/eslint-plugin-vx/docs for more documentation on individual rules.
      'vx/no-array-sort-mutation': 'error',
      'vx/no-assert-truthiness': 'error',
      'vx/no-floating-results': ['error', { ignoreVoid: true }],

      // Disallow awaiting a value that is not Thenable which often indicates an error.
      '@typescript-eslint/await-thenable': 'error',
      // Enforce using interface as object type definition as recommended by Google TypeScript Style Guide.
      '@typescript-eslint/consistent-type-definitions': ['error', 'interface'],
      // Enforce explicit return types on exports for readability
      '@typescript-eslint/explicit-module-boundary-types': 'error',
      // Overridden by vx/gts-no-array-constructor
      '@typescript-eslint/no-array-constructor': 'off',
      // Enforce handling promises appropriately to avoid potential bugs
      '@typescript-eslint/no-floating-promises': 'error',
      // Disallows the non-null assertion ! operator as recommended by the Google TypeScript Style Guide.
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/no-unnecessary-type-assertion': 'off', // Seems to be triggering a lot more than before
      // Disallows unused variables to prevent bugs
      '@typescript-eslint/no-unused-vars': 'error',
      // Enforce private properties are readonly as recommended by the Google TypeScript Style Guide.
      '@typescript-eslint/prefer-readonly': 'error',
      // Disallows async functions with no await to prevent bugs and confusion
      '@typescript-eslint/require-await': 'error',

      // Configure default rules as recommended by Google TypeScript Style Guide.
      'class-methods-use-this': 'off',
      'consistent-return': 'off',
      'dot-notation': 'off',
      // be stricter than eslint-config-airbnb which allows `== null`
      eqeqeq: ['error', 'always'],
      'import/extensions': 'off',
      // TODO: Broken after upgrading - figure out why.
      // 'import/no-extraneous-dependencies': [
      //   'error',
      //   {
      //     devDependencies: [
      //       '**/*.test.ts',
      //       '**/*.test.tsx',
      //       'test/**/*',
      //       'src/setupTests.ts',
      //       'src/setupTests.tsx',
      //       '**/*.stories.ts',
      //       '**/*.stories.tsx',
      //       '**/test_utils.ts',
      //       '**/test_utils.tsx',
      //       '**/*.bench.ts',
      //     ],
      //   },
      // ],
      'import/no-self-import': 'off',
      'import/no-unresolved': 'off',
      'import/no-named-as-default-member': 'off',
      'import/no-named-as-default': 'off',
      'import/named': 'off', // Lots of false positives, already covered by typechecker.
      'import/prefer-default-export': 'off',
      'lines-between-class-members': 'off',
      'no-await-in-loop': 'off',
      'no-continue': 'off',
      'no-empty-function': 'off',
      'no-nested-ternary': 'off',
      'no-restricted-globals': ['error', 'Buffer'],
      'no-restricted-syntax': 'off',
      'no-return-await': 'off',
      'no-underscore-dangle': [
        'error',
        {
          allow: [
            // Update this to mirror CVR properties.
            '_precinctId',
            '_ballotId',
            '_ballotStyleId',
            '_ballotType',
            '_batchId',
            '_batchLabel',
            '_testBallot',
            '_scannerId',
          ],
        },
      ],
      'no-void': 'off', // allow silencing `no-floating-promises` with `void`
      'nonblock-statement-body-position': ['error', 'beside'],
      'prefer-arrow-callback': 'error',

      // replace some built-in rules that don't play well with TypeScript, with Typescript-aware versions
      '@typescript-eslint/no-shadow': 'error',
      'no-shadow': 'off',
      'no-use-before-define': 'off',
      '@typescript-eslint/no-use-before-define': [
        'error',
        {
          functions: false,
          typedefs: false,
        },
      ],
      '@typescript-eslint/no-useless-constructor': 'error',
      'no-useless-constructor': 'off',
    },
  },

  {
    files: ['**/*.tsx'],
    plugins: {
      react: pluginReact,
      'react-hooks': {
        rules: pluginReactHooks.rules,
      },
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
    rules: {
      'jsx-a11y/label-has-associated-control': [
        'error',
        { controlComponents: ['Select'] },
      ],
      'jsx-a11y/no-autofocus': 'off',
      'react/jsx-filename-extension': ['error', { extensions: allExtensions }],
      'react/jsx-fragments': ['error', 'element'],
      'react/jsx-no-bind': 'off',
      'react/jsx-no-constructed-context-values': 'off',
      'react/jsx-no-useless-fragment': ['error', { allowExpressions: true }],
      'react/jsx-one-expression-per-line': 'off',
      'react/jsx-props-no-spreading': 'off',
      'react/jsx-wrap-multilines': 'off',
      'react/prop-types': 'off',
      'react/require-default-props': 'off',
      'vx/no-react-hook-mutation-dependency': 'error',
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',
    },
  },

  {
    files: ['**/*.test.ts', '**/*.test.tsx'],
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
      'no-loop-func': 'off',
      'vx/gts-direct-module-export-access-only': 'off',
    },
  },

  {
    files: ['**/*.test.ts', '**/*.test.tsx'],
    plugins: {
      jest: pluginJest,
    },
    rules: {
      'jest/max-nested-describe': ['error', { max: 1 }],
      'jest/no-identical-title': 'error',
      'jest/no-focused-tests': 'error',
      'jest/valid-expect': ['error', { alwaysAwait: true }],
      'vx/no-jest-to-be': 'error',
      // Account for module mocks appearing before variables they use:
      '@typescript-eslint/no-use-before-define': 'off',
    },
  },

  {
    files: ['**/*.stories.ts', '**/*.stories.tsx'],
    rules: {
      // Default exports are required in the Common Story Format (CSF) used by storybook.js
      'vx/gts-no-default-exports': 'off',
    },
  },

  {
    files: [
      '**/react_testing_library.ts', // Re-exporting external API with overrides.
      '**/react_testing_library.tsx', // Re-exporting external API with overrides.
    ],
    rules: {
      'import/export': 'off',
    },
  },

  {
    files: [
      '**/config.ts', // External APIs
      '**/*.config.ts', // External APIs
      '**/*.stories.ts', // External API
      '**/*.stories.tsx', // External API
      '**/eslint-plugin-vx/**/*.ts', // External APIs
      '**/eslint-plugin-vx/**/*.tsx', // External APIs
      '**/eslint/config.ts', // External API
      '**/jest/transform.ts', // External API
    ],
    rules: {
      'vx/gts-no-default-exports': 'off',
    },
  },
] as Linter.FlatConfig[];
