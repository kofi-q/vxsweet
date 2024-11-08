import { ensureDirSync } from 'fs-extra';
import { join, resolve } from 'node:path';
import {
  type DiskSpaceSummary,
  initializeGetWorkspaceDiskSpaceSummary,
} from '@vx/libs/backend/diagnostics';
import { BaseLogger } from '@vx/libs/logging/src';
import { Store } from '../store/store';
import { isIntegrationTest } from '@vx/libs/utils/src';

/**
 * Options for defining a Workspace.
 */
export interface Workspace {
  readonly path: string;
  readonly store: Store;
  getDiskSpaceSummary: () => Promise<DiskSpaceSummary>;
}

/**
 * Returns a Workspace with the path of the working directory and store.
 */
export function createWorkspace(root: string, logger: BaseLogger): Workspace {
  const resolvedRoot = resolve(root);
  ensureDirSync(resolvedRoot);

  const dbPath = join(resolvedRoot, 'data.db');
  const store =
    process.env.NODE_ENV === 'test' || isIntegrationTest()
      ? Store.memoryStore()
      : Store.fileStore(dbPath, logger);

  // check disk space on summary to detect a new maximum available disk space
  const getWorkspaceDiskSpaceSummary = initializeGetWorkspaceDiskSpaceSummary(
    store,
    [resolvedRoot]
  );

  return {
    path: resolvedRoot,
    store,
    getDiskSpaceSummary: getWorkspaceDiskSpaceSummary,
  };
}
