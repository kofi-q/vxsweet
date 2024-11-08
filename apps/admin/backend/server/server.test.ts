import { assert } from '@vx/libs/basics/assert';

import { LogEventId, mockBaseLogger } from '@vx/libs/logging/src';
import { Server } from 'node:http';
import { dirSync } from 'tmp';
import { buildMockDippedSmartCardAuth } from '@vx/libs/auth/test-utils';
import { createMockUsbDrive } from '@vx/libs/usb-drive/src';
import { createMockPrinterHandler } from '@vx/libs/printing/src/printer';
import { testDetectDevices } from '@vx/libs/backend/src';
import { start } from './server';
import { createWorkspace } from '../workspace/workspace';
import { PORT } from '../globals/globals';
import { buildApp } from '../app/app';
import { buildMockLogger } from '../test/app';

beforeEach(() => {
  jest.restoreAllMocks();
});

test('starts with default logger and port', async () => {
  const auth = buildMockDippedSmartCardAuth();
  const workspace = createWorkspace(dirSync().name, mockBaseLogger());
  const logger = buildMockLogger(auth, workspace);
  const { usbDrive } = createMockUsbDrive();
  const { printer } = createMockPrinterHandler();
  const app = buildApp({ auth, workspace, logger, usbDrive, printer });

  // don't actually listen
  jest.spyOn(app, 'listen').mockImplementationOnce((_port, onListening) => {
    onListening?.();
    return undefined as unknown as Server;
  });
  jest.spyOn(console, 'log').mockImplementation();

  // start up the server
  await start({ app, workspace });

  expect(app.listen).toHaveBeenCalledWith(PORT, expect.anything());

  // eslint-disable-next-line no-console
  expect(console.log).toHaveBeenCalled();
});

test('start with config options', async () => {
  const auth = buildMockDippedSmartCardAuth();
  const workspace = createWorkspace(dirSync().name, mockBaseLogger());
  const logger = buildMockLogger(auth, workspace);
  const { usbDrive } = createMockUsbDrive();
  const { printer } = createMockPrinterHandler();
  const app = buildApp({ auth, workspace, logger, usbDrive, printer });

  // don't actually listen
  jest.spyOn(app, 'listen').mockImplementationOnce((_port, onListening) => {
    onListening?.();
    return undefined as unknown as Server;
  });
  jest.spyOn(console, 'log').mockImplementation();

  // start up the server
  await start({ app, workspace, port: 3005, logger });

  expect(app.listen).toHaveBeenCalledWith(3005, expect.anything());
  expect(logger.log).toHaveBeenCalled();
});

test('errors on start with no workspace', async () => {
  const auth = buildMockDippedSmartCardAuth();
  const workspace = createWorkspace(dirSync().name, mockBaseLogger());
  const logger = buildMockLogger(auth, workspace);
  const { usbDrive } = createMockUsbDrive();
  const { printer } = createMockPrinterHandler();
  const app = buildApp({ auth, workspace, logger, usbDrive, printer });

  // start up the server
  try {
    await start({
      app,
      workspace: undefined,
      logger,
    });
  } catch (err: unknown) {
    assert(err instanceof Error);
    expect(err.message).toMatch(
      'workspace path could not be determined; pass a workspace or run with ADMIN_WORKSPACE'
    );
    expect(logger.log).toHaveBeenCalledWith(
      LogEventId.WorkspaceConfigurationMessage,
      'system',
      {
        message: expect.stringContaining(
          'workspace path could not be determined'
        ),
        disposition: 'failure',
      }
    );
  }
});

test('logs device attach/un-attach events', async () => {
  const auth = buildMockDippedSmartCardAuth();
  const workspace = createWorkspace(dirSync().name, mockBaseLogger());
  const logger = buildMockLogger(auth, workspace);
  const { usbDrive } = createMockUsbDrive();
  const { printer } = createMockPrinterHandler();
  const app = buildApp({ auth, workspace, logger, usbDrive, printer });

  // don't actually listen
  jest.spyOn(app, 'listen').mockImplementationOnce((_port, onListening) => {
    onListening?.();
    return undefined as unknown as Server;
  });
  jest.spyOn(console, 'log').mockImplementation();

  // start up the server
  await start({ app, workspace, port: 3005, logger });

  testDetectDevices(logger);
});
