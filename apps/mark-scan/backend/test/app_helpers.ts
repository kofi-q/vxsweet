import { buildMockInsertedSmartCardAuth } from '@vx/libs/auth/test-utils';
import { type InsertedSmartCardAuthApi } from '@vx/libs/auth/inserted-cards';
import * as grout from '@vx/libs/grout/src';
import { Application } from 'express';
import { AddressInfo } from 'node:net';
import { mockLogger, Logger, mockBaseLogger } from '@vx/libs/logging/src';
import { LogSource } from '@vx/libs/logging/src/base_types';
import tmp from 'tmp';
import { mockElectionPackageFileTree } from '@vx/libs/backend/election_package';
import { Server } from 'node:http';
import { electionFamousNames2021Fixtures } from '@vx/libs/fixtures/src';
import {
  mockElectionManagerUser,
  mockSessionExpiresAt,
  mockOf,
  backendWaitFor,
} from '@vx/libs/test-utils/src';
import {
  DEFAULT_SYSTEM_SETTINGS,
  type SystemSettings,
  constructElectionKey,
  TEST_JURISDICTION,
} from '@vx/libs/types/elections';
import { MockPaperHandlerDriver } from '@vx/libs/custom-paper-handler/src/driver';
import { assert } from '@vx/libs/basics/assert';
import { createMockUsbDrive, type MockUsbDrive } from '@vx/libs/usb-drive/src';
import { SimulatedClock } from 'xstate/lib/SimulatedClock';
import { type Api, buildApp } from '../app/app';
import { createWorkspace, type Workspace } from '../util/workspace';
import {
  getPaperHandlerStateMachine,
  type PaperHandlerStateMachine,
} from '../custom-paper-handler/state_machine';
import { type PatConnectionStatusReaderInterface } from '../pat-input/connection_status_reader';
import { getUserRole } from '../util/auth';
import { MockPatConnectionStatusReader } from '../pat-input/mock_connection_status_reader';

export function buildMockLogger(
  auth: InsertedSmartCardAuthApi,
  workspace: Workspace
): Logger {
  return mockLogger(LogSource.VxMarkScanBackend, () =>
    getUserRole(auth, workspace)
  );
}

export async function getMockStateMachine(
  workspace: Workspace,
  patConnectionStatusReader: PatConnectionStatusReaderInterface,
  driver: MockPaperHandlerDriver,
  logger: Logger,
  clock: SimulatedClock,
  authOverride?: InsertedSmartCardAuthApi
): Promise<PaperHandlerStateMachine> {
  // State machine setup
  const auth = authOverride ?? buildMockInsertedSmartCardAuth();
  const stateMachine = await getPaperHandlerStateMachine({
    workspace,
    auth,
    logger,
    driver,
    patConnectionStatusReader,
    clock,
  });
  assert(stateMachine);

  return stateMachine;
}

interface MockAppContents {
  apiClient: grout.Client<Api>;
  app: Application;
  logger: Logger;
  mockAuth: InsertedSmartCardAuthApi;
  mockUsbDrive: MockUsbDrive;
  server: Server;
  stateMachine: PaperHandlerStateMachine;
  patConnectionStatusReader: PatConnectionStatusReaderInterface;
  driver: MockPaperHandlerDriver;
  clock: SimulatedClock;
}

export interface CreateAppOptions {
  patConnectionStatusReader?: PatConnectionStatusReaderInterface;
  pollingIntervalMs?: number;
}

export async function createApp(
  options?: CreateAppOptions
): Promise<MockAppContents> {
  const mockAuth = buildMockInsertedSmartCardAuth();
  const workspace = createWorkspace(tmp.dirSync().name, mockBaseLogger());
  const logger = buildMockLogger(mockAuth, workspace);
  const mockUsbDrive = createMockUsbDrive();
  const patConnectionStatusReader =
    options?.patConnectionStatusReader ??
    new MockPatConnectionStatusReader(logger);
  const driver = new MockPaperHandlerDriver();
  const clock = new SimulatedClock();

  const stateMachine = await getMockStateMachine(
    workspace,
    patConnectionStatusReader,
    driver,
    logger,
    clock,
    mockAuth
  );

  const app = buildApp(
    mockAuth,
    logger,
    workspace,
    mockUsbDrive.usbDrive,
    stateMachine
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
    server,
    stateMachine,
    patConnectionStatusReader,
    driver,
    clock,
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

export async function waitForStatus(
  apiClient: grout.Client<Api>,
  interval: number,
  status: string
): Promise<void> {
  await backendWaitFor(
    async () => {
      expect(await apiClient.getPaperHandlerState()).toEqual(status);
    },
    { interval, retries: 3 }
  );
}
