import { emptyDirSync, ensureDirSync } from 'fs-extra';
import { join, resolve } from 'node:path';
import { isIntegrationTest, Mutex } from '@vx/libs/utils/src';
import {
  type DiskSpaceSummary,
  initializeGetWorkspaceDiskSpaceSummary,
} from '@vx/libs/backend/diagnostics';
import { BaseLogger } from '@vx/libs/logging/src';
import { Store } from '../store/store';

export interface Workspace {
  /**
   * The path to the workspace root.
   */
  readonly path: string;

  /**
   * The directory where interpreted images are stored.
   */
  readonly ballotImagesPath: string;

  /**
   * The directory where the scanner will save images.
   */
  readonly scannedImagesPath: string;

  /**
   * The directory where files are uploaded.
   */
  readonly uploadsPath: string;

  /**
   * The store associated with the workspace.
   */
  readonly store: Store;

  /**
   * A mutex to ensure that continuous export operations happen sequentially and do not interleave.
   */
  readonly continuousExportMutex: Mutex;

  /**
   * Zero out the data in the workspace, but leave the configuration.
   */
  resetElectionSession(): void;

  /**
   * Reset the workspace, including the election configuration. This is the same
   * as deleting the workspace and recreating it.
   */
  reset(): void;

  /**
   * Clears the uploads directory.
   */
  clearUploads(): void;

  /**
   * Returns a summary of disk space usage for use in diagnostics.
   */
  getDiskSpaceSummary: () => Promise<DiskSpaceSummary>;
}

export function createWorkspace(
  root: string,
  logger: BaseLogger,
  options: { store?: Store } = {}
): Workspace {
  const resolvedRoot = resolve(root);
  const ballotImagesPath = join(resolvedRoot, 'ballot-images');
  const scannedImagesPath = join(ballotImagesPath, 'scanned-images');
  const uploadsPath = join(resolvedRoot, 'uploads');
  ensureDirSync(ballotImagesPath);
  ensureDirSync(scannedImagesPath);

  const dbPath = join(resolvedRoot, 'ballots.db');
  const store = options.store
    ? options.store
    : process.env.NODE_ENV === 'test' || isIntegrationTest()
    ? Store.memoryStore()
    : Store.fileStore(dbPath, logger);

  // check disk space on startup to detect a new maximum available disk space
  const getWorkspaceDiskSpaceSummary = initializeGetWorkspaceDiskSpaceSummary(
    store,
    [resolvedRoot]
  );

  return {
    path: resolvedRoot,
    ballotImagesPath,
    scannedImagesPath,
    uploadsPath,
    store,
    continuousExportMutex: new Mutex(),
    resetElectionSession() {
      store.resetElectionSession();
      emptyDirSync(ballotImagesPath);
      emptyDirSync(scannedImagesPath);
      ensureDirSync(ballotImagesPath);
      ensureDirSync(scannedImagesPath);
    },
    reset() {
      store.reset();
      emptyDirSync(ballotImagesPath);
      emptyDirSync(scannedImagesPath);
      ensureDirSync(ballotImagesPath);
      ensureDirSync(scannedImagesPath);
    },
    clearUploads() {
      emptyDirSync(uploadsPath);
    },
    getDiskSpaceSummary: getWorkspaceDiskSpaceSummary,
  };
}
