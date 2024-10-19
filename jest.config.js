/**
 * References a built version of `tools/jest/config.ts`
 * To bootstrap and get things working in an IDE, or to refresh the config
 * making changes to the source, run:
 *
 * ```
 *   bazel build //tools/jest
 * ```
 *
 * NOTE: Might need to restart the ESLint server in the IDE after doing that.
 *
 * The reference will automatically get build when running jest via the watch
 * command:
 * ```
 *   bazel run //tools/jest:watch <test_file_pattern>
 * ```
 */

module.exports = require('./bazel-bin/tools/jest/config.js');
