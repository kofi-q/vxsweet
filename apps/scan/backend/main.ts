import 'tsx/cjs';

import * as customScanner from '@vx/libs/custom-scanner/src';
import { BaseLogger, LogEventId, Logger } from '@vx/libs/logging/src';
import { LogSource } from '@vx/libs/logging/src/base_types';
import { detectUsbDrive } from '@vx/libs/usb-drive/src';
import { InsertedSmartCardAuth } from '@vx/libs/auth/inserted-cards';
import { JavaCard } from '@vx/libs/auth/cards';
import { MockFileCard } from '@vx/libs/auth/mock-cards';
import {
  BooleanEnvironmentVariableName,
  isFeatureFlagEnabled,
  isIntegrationTest,
} from '@vx/libs/utils/src';
import { handleUncaughtExceptions } from '@vx/libs/backend/exceptions';
import { loadEnvVarsFromDotenvFiles } from '@vx/libs/backend/env';
import { createPdiScannerClient } from '@vx/libs/pdi-scanner/src/ts';
import { SCAN_WORKSPACE } from './globals/globals';
import * as customStateMachine from './scanners/custom/state_machine';
import * as pdiStateMachine from './scanners/pdi/state_machine';
import * as server from './server/server';
import { createWorkspace, type Workspace } from './workspace/workspace';
import { getUserRole } from './auth/auth';
import { getPrinter } from './printing/printer';

loadEnvVarsFromDotenvFiles();

const baseLogger = new BaseLogger(LogSource.VxScanBackend);

async function resolveWorkspace(): Promise<Workspace> {
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
  return createWorkspace(workspacePath, baseLogger);
}

async function main(): Promise<number> {
  handleUncaughtExceptions(baseLogger);

  const auth = new InsertedSmartCardAuth({
    card:
      isFeatureFlagEnabled(BooleanEnvironmentVariableName.USE_MOCK_CARDS) ||
      isIntegrationTest()
        ? new MockFileCard()
        : new JavaCard(),
    config: {},
    logger: baseLogger,
  });
  const workspace = await resolveWorkspace();
  const logger = Logger.from(baseLogger, () => getUserRole(auth, workspace));
  const usbDrive = detectUsbDrive(logger);
  const printer = getPrinter(logger);

  const precinctScannerStateMachine = isFeatureFlagEnabled(
    BooleanEnvironmentVariableName.USE_CUSTOM_SCANNER
  )
    ? customStateMachine.createPrecinctScannerStateMachine({
        createCustomClient: customScanner.openScanner,
        auth,
        workspace,
        logger,
        usbDrive,
      })
    : pdiStateMachine.createPrecinctScannerStateMachine({
        createScannerClient: createPdiScannerClient,
        workspace,
        usbDrive,
        auth,
        logger,
      });

  server.start({
    auth,
    precinctScannerStateMachine,
    workspace,
    usbDrive,
    printer,
    logger,
  });

  return 0;
}

void main()
  .catch((error) => {
    void baseLogger.log(LogEventId.ApplicationStartup, 'system', {
      message: `Error in starting VxScan backend: ${error.stack}`,
      disposition: 'failure',
    });
    return 1;
  })
  .then((code) => {
    process.exitCode = code;
  });
