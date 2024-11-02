import { ensureDirSync } from 'fs-extra';
import { join } from 'node:path';

import { BaseLogger } from '@vx/libs/logging/src';
import { Store } from '../store/store';

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
  const store = Store.fileStore(dbPath, logger);

  return { assetDirectoryPath, store };
}
