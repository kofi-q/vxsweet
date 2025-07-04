/* istanbul ignore file */
import { unsafeParse } from '@vx/libs/types/basic';
import { join } from 'node:path';
import { z } from 'zod';

/**
 * Default port for the VxMarkScan API.
 */
// eslint-disable-next-line vx/gts-safe-number-parse
export const PORT = Number(process.env.PORT || 3002);

const NodeEnvSchema = z.union([
  z.literal('development'),
  z.literal('test'),
  z.literal('production'),
]);

const NODE_ENV = unsafeParse(
  NodeEnvSchema,
  process.env.NODE_ENV ?? 'development'
);

/**
 * Which node environment is this?
 *
 * NOTE: Exposed as a function to enable mocking.
 */
export function getNodeEnv(): z.TypeOf<typeof NodeEnvSchema> {
  return NODE_ENV;
}

const REPO_ROOT =
  process.env.BUILD_WORKSPACE_DIRECTORY || join(__dirname, '../../..');

/**
 * Where should the database, audio, and hardware status files go?
 */
export const MARK_SCAN_WORKSPACE =
  process.env.MARK_SCAN_WORKSPACE ??
  (NODE_ENV === 'development'
    ? join(REPO_ROOT, 'apps/mark-scan/backend/dev-workspace')
    : undefined);
