import { unsafeParse } from '@vx/libs/types/basic';
import { join } from 'node:path';
import { z } from 'zod';

const NodeEnvSchema = z.union([
  z.literal('development'),
  z.literal('test'),
  z.literal('production'),
]);

/**
 * Default port for the server.
 */
// eslint-disable-next-line vx/gts-safe-number-parse
export const PORT = Number(process.env.PORT || 3002);

/**
 * Which node environment is this?
 */
export const NODE_ENV = unsafeParse(
  NodeEnvSchema,
  process.env.NODE_ENV ?? 'development'
);

const REPO_ROOT =
  process.env.BUILD_WORKSPACE_DIRECTORY || join(__dirname, '../../..');

/**
 * Where should the database go?
 */
export const WORKSPACE =
  process.env.WORKSPACE ??
  (NODE_ENV === 'development'
    ? join(REPO_ROOT, 'apps/design/backend/dev-workspace')
    : undefined);
