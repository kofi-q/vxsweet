import { ensureDirSync } from 'fs-extra';
import { join } from 'node:path';

import { BaseLogger } from '@vx/libs/logging/src';
import { Store } from '../store/store';
import { isIntegrationTest } from '@vx/libs/utils/src';

export interface Workspace {
  assetDirectoryPath: string;
  store: Store;
}

export function createWorkspace(
  workspacePath: string,
  logger: BaseLogger
): Workspace {
  ensureDirSync(workspacePath);

  const assetDirectoryPath = join(workspacePath, 'assets');
  ensureDirSync(assetDirectoryPath);

  const dbPath = join(workspacePath, 'design-backend.db');
  const store =
    process.env.NODE_ENV === 'test' || isIntegrationTest()
      ? Store.memoryStore()
      : Store.fileStore(dbPath, logger);

  return { assetDirectoryPath, store };
}
