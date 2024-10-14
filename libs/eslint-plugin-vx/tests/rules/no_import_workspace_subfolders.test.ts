import { RuleTester } from '@typescript-eslint/utils/ts-eslint';
import { join } from 'node:path';
import rule from '../../src/rules/no_import_workspace_subfolders';

const ruleTester = new RuleTester({
  parserOptions: {
    ecmaVersion: 2018,
    tsconfigRootDir: join(__dirname, '../fixtures'),
    project: './tsconfig.json',
  },
  parser: require.resolve('@typescript-eslint/parser'),
});

ruleTester.run('no-import-workspace-subfolders', rule, {
  valid: [
    {
      code: `import 'a'`,
    },
    {
      code: `import a from '@vx/libs/something/src'`,
    },
    {
      code: `import { a } from '@vx/libs/something/src'`,
    },
    {
      code: `import * as a from '@vx/libs/something/src'`,
    },
    {
      code: `import a from 'random-library/something'`,
    },
    {
      code: `import { a } from 'random-library'`,
    },
    {
      code: `import * as a from 'random/library/with/many/slashes'`,
    },
    {
      code: `import a from '@vx/libs/types/something/else/src'`,
    },
    {
      code: `import { a } from '@vx/libs/types/api/services/scan/src'`,
    },
    {
      code: `import * as a from '@vx/libs/types/a/bunch/of/folders/src'`,
    },
  ],
  invalid: [
    {
      code: `import a from '@vx/libs/something/src/src'`,
      output: `import a from '@vx/libs/something/src'`,
      errors: [{ messageId: 'noImportSubfolders', line: 1 }],
    },
    {
      code: `import { a } from '@vx/libs/something/src/src'`,
      output: `import { a } from '@vx/libs/something/src'`,
      errors: [{ messageId: 'noImportSubfolders', line: 1 }],
    },
    {
      code: `import * as a from '@vx/libs/something/src/src'`,
      output: `import * as a from '@vx/libs/something/src'`,
      errors: [{ messageId: 'noImportSubfolders', line: 1 }],
    },
    {
      code: `import a from '@vx/libs/something/utils/src'`,
      output: `import a from '@vx/libs/something/src'`,
      errors: [{ messageId: 'noImportSubfolders', line: 1 }],
    },
    {
      code: `import { a } from '@vx/libs/something/src/utils/lib/src'`,
      output: `import { a } from '@vx/libs/something/src'`,
      errors: [{ messageId: 'noImportSubfolders', line: 1 }],
    },
    {
      code: `import * as a from '@vx/libs/something/src/utils/src'`,
      output: `import * as a from '@vx/libs/something/src'`,
      errors: [{ messageId: 'noImportSubfolders', line: 1 }],
    },
  ],
});
