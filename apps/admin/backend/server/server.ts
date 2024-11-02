import { LogEventId, BaseLogger, Logger } from '@vx/libs/logging/src';
import { LogSource } from '@vx/libs/logging/src/base_types';
import { Application } from 'express';
import { DippedSmartCardAuth, JavaCard, MockFileCard } from '@vx/libs/auth/src';
import { Server } from 'node:http';
import {
  BooleanEnvironmentVariableName,
  isFeatureFlagEnabled,
  isIntegrationTest,
} from '@vx/libs/utils/src';
import { detectUsbDrive, type UsbDrive } from '@vx/libs/usb-drive/src';
import { type Printer, detectPrinter } from '@vx/libs/printing/src/printer';
import { detectDevices } from '@vx/libs/backend/src';
import { ADMIN_WORKSPACE, PORT } from '../globals/globals';
import { createWorkspace, type Workspace } from '../workspace/workspace';
import { buildApp } from '../app/app';
import { rootDebug } from '../util/logging/debug';
import { getUserRole } from '../util/auth/auth';

const debug = rootDebug.extend('server');

/**
 * Options for starting the admin service.
 */
export interface StartOptions {
  app: Application;
  logger: BaseLogger;
  port: number | string;
  workspace: Workspace;
  usbDrive?: UsbDrive;
  printer?: Printer;
}

/**
 * Starts the server with all the default options.
 */
export async function start({
  app,
  logger: baseLogger = new BaseLogger(LogSource.VxAdminService),
  port = PORT,
  workspace,
  usbDrive,
  printer,
}: Partial<StartOptions>): Promise<Server> {
  debug('starting server...');
  detectDevices({ logger: baseLogger });
  let resolvedWorkspace = workspace;
  /* istanbul ignore next */
  if (!resolvedWorkspace) {
    const workspacePath = ADMIN_WORKSPACE;
    if (!workspacePath) {
      await baseLogger.log(LogEventId.WorkspaceConfigurationMessage, 'system', {
        message:
          'workspace path could not be determined; pass a workspace or run with ADMIN_WORKSPACE',
        disposition: 'failure',
      });
      throw new Error(
        'workspace path could not be determined; pass a workspace or run with ADMIN_WORKSPACE'
      );
    }
    resolvedWorkspace = createWorkspace(workspacePath, baseLogger);
  }

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
        allowElectionManagersToAccessUnconfiguredMachines: false,
      },
      logger: baseLogger,
    });

    const logger = Logger.from(baseLogger, () =>
      getUserRole(auth, resolvedWorkspace)
    );

    const resolvedUsbDrive = usbDrive ?? detectUsbDrive(logger);
    const resolvedPrinter = printer ?? detectPrinter(logger);

    resolvedApp = buildApp({
      auth,
      logger,
      usbDrive: resolvedUsbDrive,
      printer: resolvedPrinter,
      workspace: resolvedWorkspace,
    });
  }

  const server = resolvedApp.listen(port, async () => {
    await baseLogger.log(LogEventId.ApplicationStartup, 'system', {
      message: `Admin Service running at http://localhost:${port}/`,
      disposition: 'success',
    });
  });
  return server;
}
