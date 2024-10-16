import {
  buildMockInsertedSmartCardAuth,
  InsertedSmartCardAuthApi,
} from '@vx/libs/auth/src';
import * as grout from '@vx/libs/grout/src';
import { Application } from 'express';
import { AddressInfo } from 'node:net';
import {
  mockLogger,
  LogSource,
  Logger,
  mockBaseLogger,
} from '@vx/libs/logging/src';
import tmp from 'tmp';
import { mockElectionPackageFileTree } from '@vx/libs/backend/src';
import { Server } from 'node:http';
import { electionFamousNames2021Fixtures } from '@vx/libs/fixtures/src';
import {
  mockElectionManagerUser,
  mockSessionExpiresAt,
  mockOf,
} from '@vx/libs/test-utils/src';
import {
  DEFAULT_SYSTEM_SETTINGS,
  constructElectionKey,
  SystemSettings,
  TEST_JURISDICTION,
} from '@vx/libs/types/src';
import { createMockUsbDrive, MockUsbDrive } from '@vx/libs/usb-drive/src';
import {
  createMockPrinterHandler,
  MemoryPrinterHandler,
} from '@vx/libs/printing/src';
import { Api, buildApp } from '../src/app';
import { createWorkspace, Workspace } from '../src/util/workspace';
import { getUserRole } from '../src/util/auth';

interface MockAppContents {
  apiClient: grout.Client<Api>;
  app: Application;
  logger: Logger;
  mockAuth: InsertedSmartCardAuthApi;
  mockUsbDrive: MockUsbDrive;
  mockPrinterHandler: MemoryPrinterHandler;
  server: Server;
}

export function buildMockLogger(
  auth: InsertedSmartCardAuthApi,
  workspace: Workspace
): Logger {
  return mockLogger(LogSource.VxMarkBackend, () =>
    getUserRole(auth, workspace)
  );
}

export function createApp(): MockAppContents {
  const workspace = createWorkspace(tmp.dirSync().name, mockBaseLogger());
  const mockAuth = buildMockInsertedSmartCardAuth();
  const logger = buildMockLogger(mockAuth, workspace);
  const mockUsbDrive = createMockUsbDrive();
  const mockPrinterHandler = createMockPrinterHandler();

  const app = buildApp(
    mockAuth,
    logger,
    workspace,
    mockUsbDrive.usbDrive,
    mockPrinterHandler.printer
  );

  const server = app.listen();
  const { port } = server.address() as AddressInfo;
  const baseUrl = `http://localhost:${port}/api`;

  const apiClient = grout.createClient<Api>({ baseUrl });

  return {
    apiClient,
    app,
    logger,
    mockAuth,
    mockUsbDrive,
    mockPrinterHandler,
    server,
  };
}

export async function configureApp(
  apiClient: grout.Client<Api>,
  mockAuth: InsertedSmartCardAuthApi,
  mockUsbDrive: MockUsbDrive,
  systemSettings: SystemSettings = DEFAULT_SYSTEM_SETTINGS
): Promise<void> {
  const jurisdiction = TEST_JURISDICTION;
  const { electionJson, election } = electionFamousNames2021Fixtures;
  mockOf(mockAuth.getAuthStatus).mockImplementation(() =>
    Promise.resolve({
      status: 'logged_in',
      user: mockElectionManagerUser({
        electionKey: constructElectionKey(election),
        jurisdiction,
      }),
      sessionExpiresAt: mockSessionExpiresAt(),
    })
  );
  mockUsbDrive.insertUsbDrive(
    await mockElectionPackageFileTree(
      electionJson.toElectionPackage(systemSettings)
    )
  );
  const result = await apiClient.configureElectionPackageFromUsb();
  expect(result.isOk()).toEqual(true);
  mockOf(mockAuth.getAuthStatus).mockImplementation(() =>
    Promise.resolve({
      status: 'logged_out',
      reason: 'no_card',
    })
  );
}
