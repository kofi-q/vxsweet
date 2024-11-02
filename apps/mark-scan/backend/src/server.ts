import { Server } from 'node:http';
import { type InsertedSmartCardAuthApi } from '@vx/libs/auth/src';
import { LogEventId, BaseLogger, Logger } from '@vx/libs/logging/src';
import {
  getPaperHandlerDriver,
  MaxPrintWidthDots,
  MockPaperHandlerDriver,
  type PaperHandlerDriverInterface,
} from '@vx/libs/custom-paper-handler/src/driver';
import {
  BooleanEnvironmentVariableName,
  isFeatureFlagEnabled,
} from '@vx/libs/utils/src';
import { detectUsbDrive } from '@vx/libs/usb-drive/src';
import { detectDevices, initializeSystemAudio } from '@vx/libs/backend/src';
import { buildApp } from './app';
import { type Workspace } from './util/workspace';
import { getPaperHandlerStateMachine } from './custom-paper-handler/state_machine';
import { getDefaultAuth, getUserRole } from './util/auth';
import {
  PatConnectionStatusReader,
  type PatConnectionStatusReaderInterface,
} from './pat-input/connection_status_reader';
import { MockPatConnectionStatusReader } from './pat-input/mock_connection_status_reader';
import { getMarkScanBmdModel } from './util/hardware';

export interface StartOptions {
  auth?: InsertedSmartCardAuthApi;
  logger: BaseLogger;
  port: number | string;
  workspace: Workspace;
}

export async function resolveDriver(
  logger: BaseLogger
): Promise<PaperHandlerDriverInterface | undefined> {
  if (
    isFeatureFlagEnabled(BooleanEnvironmentVariableName.USE_MOCK_PAPER_HANDLER)
  ) {
    await logger.log(LogEventId.PaperHandlerConnection, 'system', {
      message: 'Starting server with mock paper handler',
    });
    return new MockPaperHandlerDriver();
  }

  const maxPrintWidth =
    /* istanbul ignore next - hardware support in flux */
    getMarkScanBmdModel() === 'bmd-150'
      ? /* istanbul ignore next - hardware support in flux */
        MaxPrintWidthDots.BMD_150
      : MaxPrintWidthDots.BMD_155;
  const driver = await getPaperHandlerDriver({ maxPrintWidth });

  if (driver) {
    await logger.log(LogEventId.PaperHandlerConnection, 'system', {
      disposition: 'success',
    });
    return driver;
  }

  await logger.log(LogEventId.PaperHandlerConnection, 'system', {
    disposition: 'failure',
  });
  return undefined;
}

/**
 * Starts the server with all the default options.
 */
export async function start({
  auth,
  logger: baseLogger,
  port,
  workspace,
}: StartOptions): Promise<Server> {
  detectDevices({ logger: baseLogger });
  const resolvedAuth = auth ?? getDefaultAuth(baseLogger);
  const logger = Logger.from(baseLogger, () =>
    getUserRole(resolvedAuth, workspace)
  );
  const driver = await resolveDriver(logger);
  let patConnectionStatusReader: PatConnectionStatusReaderInterface =
    new PatConnectionStatusReader(
      logger,
      getMarkScanBmdModel(),
      workspace.path
    );
  const canReadPatConnectionStatus = await patConnectionStatusReader.open();

  if (!canReadPatConnectionStatus) {
    // Expect this branch if running on non-production hardware or in a test
    patConnectionStatusReader = new MockPatConnectionStatusReader(logger);
  }

  let stateMachine;
  // Allow the driver to start without a state machine for tests
  if (driver) {
    stateMachine = await getPaperHandlerStateMachine({
      workspace,
      auth: resolvedAuth,
      logger,
      driver,
      patConnectionStatusReader,
    });
  }

  const usbDrive = detectUsbDrive(logger);

  await initializeSystemAudio();

  const app = buildApp(
    resolvedAuth,
    logger,
    workspace,
    usbDrive,
    stateMachine,
    driver
  );

  return app.listen(
    port,
    /* istanbul ignore next */
    async () => {
      await logger.log(LogEventId.ApplicationStartup, 'system', {
        message: `VxMarkScan backend running at http://localhost:${port}/`,
        disposition: 'success',
      });
    }
  );
}
