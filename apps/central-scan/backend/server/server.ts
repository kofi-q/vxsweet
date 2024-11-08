import { BaseLogger, LogEventId, Logger } from '@vx/libs/logging/src';
import { LogSource } from '@vx/libs/logging/src/base_types';
import { Application } from 'express';
import { DippedSmartCardAuth } from '@vx/libs/auth/dipped-cards';
import { JavaCard } from '@vx/libs/auth/cards';
import { MockFileCard } from '@vx/libs/auth/mock-cards';
import { Server } from 'node:http';
import {
  BooleanEnvironmentVariableName,
  isFeatureFlagEnabled,
  isIntegrationTest,
} from '@vx/libs/utils/src';
import { type UsbDrive, detectUsbDrive } from '@vx/libs/usb-drive/src';
import { detectDevices } from '@vx/libs/backend/devices';
import { PORT, SCAN_WORKSPACE } from '../globals/globals';
import { Importer } from '../importer/importer';
import {
  FujitsuScanner,
  type BatchScanner,
  ScannerMode,
} from '../scanners/fujitsu/fujitsu_scanner';
import { createWorkspace, type Workspace } from '../workspace/workspace';
import { buildCentralScannerApp } from '../app/app';
import { getUserRole } from '../auth/auth';

export interface StartOptions {
  port: number | string;
  batchScanner: BatchScanner;
  usbDrive: UsbDrive;
  importer: Importer;
  app: Application;
  logger: BaseLogger;
  workspace: Workspace;
}

/**
 * Starts the server with all the default options.
 */
export async function start({
  port = PORT,
  batchScanner,
  usbDrive,
  importer,
  app,
  logger: baseLogger = new BaseLogger(LogSource.VxCentralScanService),
  workspace,
}: Partial<StartOptions> = {}): Promise<Server> {
  detectDevices({ logger: baseLogger });
  let resolvedWorkspace = workspace;
  /* istanbul ignore next */
  if (!resolvedWorkspace) {
    const workspacePath = SCAN_WORKSPACE;
    if (!workspacePath) {
      await baseLogger.log(LogEventId.WorkspaceConfigurationMessage, 'system', {
        message:
          'workspace path could not be determined; pass a workspace or run with SCAN_WORKSPACE',
        disposition: 'failure',
      });
      throw new Error(
        'workspace path could not be determined; pass a workspace or run with SCAN_WORKSPACE'
      );
    }
    resolvedWorkspace = createWorkspace(workspacePath, baseLogger);
  }

  // Clear any cached data
  resolvedWorkspace.clearUploads();
  resolvedWorkspace.store.cleanupIncompleteBatches();

  let resolvedApp = app;
  /* istanbul ignore next */
  if (!resolvedApp) {
    const auth = new DippedSmartCardAuth({
      card:
        isFeatureFlagEnabled(BooleanEnvironmentVariableName.USE_MOCK_CARDS) ||
        isIntegrationTest()
          ? new MockFileCard()
          : new JavaCard(),
      config: {
        allowElectionManagersToAccessUnconfiguredMachines: true,
      },
      logger: baseLogger,
    });

    const logger = Logger.from(baseLogger, () =>
      getUserRole(auth, resolvedWorkspace)
    );

    const resolvedBatchScanner =
      batchScanner ?? new FujitsuScanner({ mode: ScannerMode.Gray, logger });

    const resolvedImporter =
      importer ??
      new Importer({
        scanner: resolvedBatchScanner,
        workspace: resolvedWorkspace,
        logger,
      });

    const resolvedUsbDrive = usbDrive ?? detectUsbDrive(logger);

    resolvedApp = buildCentralScannerApp({
      auth,
      scanner: resolvedBatchScanner,
      importer: resolvedImporter,
      logger,
      usbDrive: resolvedUsbDrive,
      workspace: resolvedWorkspace,
    });
  }

  return resolvedApp.listen(port, async () => {
    await baseLogger.log(LogEventId.ApplicationStartup, 'system', {
      message: `Scan Service running at http://localhost:${port}/`,
      disposition: 'success',
    });

    await baseLogger.log(LogEventId.WorkspaceConfigurationMessage, 'system', {
      message: `Scanning ballots into ${resolvedWorkspace.ballotImagesPath}`,
    });
  });
}
