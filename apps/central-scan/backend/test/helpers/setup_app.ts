import { Application } from 'express';
import { LogSource } from '@vx/libs/logging/src/base_types';
import { Logger, mockBaseLogger, mockLogger } from '@vx/libs/logging/src';
import { Server } from 'node:http';
import * as grout from '@vx/libs/grout/src';
import {
  type DippedSmartCardAuthApi,
  buildMockDippedSmartCardAuth,
} from '@vx/libs/auth/src';
import { dirSync } from 'tmp';
import getPort from 'get-port';
import { type MockUsbDrive, createMockUsbDrive } from '@vx/libs/usb-drive/src';
import { type Workspace, createWorkspace } from '../../workspace/workspace';
import { type MockScanner, makeMockScanner } from '../util/mocks';
import { Importer } from '../../importer/importer';
import { type Api, buildCentralScannerApp } from '../../app/app';
import { start } from '../../server/server';
import { Store } from '../../store/store';
import { getUserRole } from '../../auth/auth';

export function buildMockLogger(
  auth: DippedSmartCardAuthApi,
  workspace: Workspace
): Logger {
  return mockLogger(LogSource.VxCentralScanService, () =>
    getUserRole(auth, workspace)
  );
}

export async function withApp(
  fn: (context: {
    auth: ReturnType<typeof buildMockDippedSmartCardAuth>;
    workspace: Workspace;
    scanner: MockScanner;
    mockUsbDrive: MockUsbDrive;
    importer: Importer;
    app: Application;
    logger: Logger;
    apiClient: grout.Client<Api>;
    server: Server;
    store: Store;
  }) => Promise<void>
): Promise<void> {
  const port = await getPort();
  const auth = buildMockDippedSmartCardAuth();
  const workspace = createWorkspace(dirSync().name, mockBaseLogger());
  const logger = buildMockLogger(auth, workspace);
  const scanner = makeMockScanner();
  const importer = new Importer({ workspace, scanner, logger });
  const mockUsbDrive = createMockUsbDrive();
  const app = buildCentralScannerApp({
    auth,
    usbDrive: mockUsbDrive.usbDrive,
    allowedExportPatterns: ['/tmp/**'],
    scanner,
    importer,
    workspace,
    logger,
  });
  const baseUrl = `http://localhost:${port}/api`;
  const apiClient = grout.createClient({
    baseUrl,
  });
  const server = await start({
    app,
    logger,
    workspace,
    port,
  });

  try {
    await fn({
      auth,
      workspace,
      store: workspace.store,
      scanner,
      mockUsbDrive,
      importer,
      app,
      logger,
      apiClient,
      server,
    });
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
    workspace.reset();
  }
}
