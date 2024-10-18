// @ts-nocheck

/**
 * References a built version of `tools/eslint/config.ts`
 * To bootstrap and get things working in an IDE, or to refresh the config
 * making changes to the source, run:
 *
 * ```
 *   bazel build //tools/eslint
 * ```
 *
 * NOTE: Might need to restart the ESLint server in the IDE after doing that.
 */

import config from './bazel-bin/tools/eslint/config.js';

export default config;
