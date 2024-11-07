/* istanbul ignore file */

import * as dotenv from 'dotenv';
import * as dotenvExpand from 'dotenv-expand';
import fs from 'node:fs';
import path from 'node:path';
import { isIntegrationTest } from '@vx/libs/utils/src';
import { assertDefined } from '@vx/libs/basics/assert';

/**
 * Loads environment variables from .env* files. dotenv will never modify environment variables
 * that have already been set.
 *
 * https://github.com/motdotla/dotenv
 * https://github.com/motdotla/dotenv-expand
 */
export function loadEnvVarsFromDotenvFiles(): void {
  const nodeEnv = process.env.NODE_ENV;
  const isTestEnvironment = nodeEnv === 'test' || isIntegrationTest();

  const repoRoot = isTestEnvironment
    ? assertDefined(process.env.PWD)
    : path.join(__dirname, '../../..');

  const executionRoot = process.env.DOTENV_EXECUTION_ROOT;

  // https://github.com/bkeepers/dotenv#what-other-env-files-can-i-use
  const dotenvPath = '.env';
  const dotenvFiles: string[] = [
    ...(executionRoot
      ? [
          // Don't include `.env.local` in test environments since we expect tests to produce the same
          // results for everyone
          !isTestEnvironment
            ? path.join(executionRoot, `${dotenvPath}.${nodeEnv}.local`)
            : '',
          !isTestEnvironment
            ? path.join(executionRoot, `${dotenvPath}.local`)
            : '',

          path.join(executionRoot, `${dotenvPath}.${nodeEnv}`),
          path.join(executionRoot, dotenvPath),
        ]
      : []),

    !isTestEnvironment ? `${dotenvPath}.local` : '',

    `${dotenvPath}.${nodeEnv}`,

    dotenvPath,
  ].filter(Boolean);

  for (const dotenvFile of dotenvFiles) {
    const absolutePath = path.join(repoRoot, dotenvFile);
    if (fs.existsSync(absolutePath)) {
      dotenvExpand.expand(dotenv.config({ path: absolutePath }));
    }
  }
}
