import { ensureDirSync } from 'fs-extra';
import { join, resolve } from 'node:path';
import { BaseLogger } from '@vx/libs/logging/src';
import { Store } from '../store/store';
import { isIntegrationTest } from '@vx/libs/utils/src';

export interface Workspace {
  /**
   * The path to the workspace root.
   */
  readonly path: string;

  /**
   * The store associated with the workspace.
   */
  readonly store: Store;

  /**
   * Reset the workspace, including the election configuration. This is the same
   * as deleting the workspace and recreating it.
   */
  reset(): void;
}

export function createWorkspace(
  root: string,
  baseLogger: BaseLogger,
  options: { store?: Store } = {}
): Workspace {
  const resolvedRoot = resolve(root);
  ensureDirSync(resolvedRoot);

  const dbPath = join(resolvedRoot, 'mark.db');
  const store = options.store
    ? options.store
    : process.env.NODE_ENV === 'test' || isIntegrationTest()
    ? Store.memoryStore()
    : Store.fileStore(dbPath, baseLogger);

  return {
    path: resolvedRoot,
    store,
    reset() {
      store.reset();
    },
  };
}
