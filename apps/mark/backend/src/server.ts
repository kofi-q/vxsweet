import { Server } from 'node:http';
import {
  InsertedSmartCardAuth,
  InsertedSmartCardAuthApi,
  JavaCard,
  MockFileCard,
} from '@vx/libs/auth/src';
import { LogEventId, BaseLogger, Logger } from '@vx/libs/logging/src';
import {
  BooleanEnvironmentVariableName,
  isFeatureFlagEnabled,
  isIntegrationTest,
} from '@vx/libs/utils/src';
import { detectUsbDrive } from '@vx/libs/usb-drive/src';
import { initializeSystemAudio } from '@vx/libs/backend/src';
import { detectPrinter } from '@vx/libs/printing/src';
import { buildApp } from './app';
import { Workspace } from './util/workspace';
import { getUserRole } from './util/auth';

export interface StartOptions {
  auth?: InsertedSmartCardAuthApi;
  baseLogger: BaseLogger;
  port: number | string;
  workspace: Workspace;
}

/**
 * Starts the server with all the default options.
 */
export async function start({
  auth,
  baseLogger,
  port,
  workspace,
}: StartOptions): Promise<Server> {
  /* istanbul ignore next */
  const resolvedAuth =
    auth ??
    new InsertedSmartCardAuth({
      card:
        isFeatureFlagEnabled(BooleanEnvironmentVariableName.USE_MOCK_CARDS) ||
        isIntegrationTest()
          ? new MockFileCard()
          : new JavaCard(),
      config: { allowCardlessVoterSessions: true },
      logger: baseLogger,
    });

  const logger = Logger.from(
    baseLogger,
    /* istanbul ignore next */ () => getUserRole(resolvedAuth, workspace)
  );
  const usbDrive = detectUsbDrive(logger);
  const printer = detectPrinter(logger);

  await initializeSystemAudio();

  const app = buildApp(resolvedAuth, logger, workspace, usbDrive, printer);

  return app.listen(
    port,
    /* istanbul ignore next */
    async () => {
      await logger.log(LogEventId.ApplicationStartup, 'system', {
        message: `VxMark backend running at http://localhost:${port}/`,
        disposition: 'success',
      });
    }
  );
}
