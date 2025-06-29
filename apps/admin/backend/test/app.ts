import { buildMockDippedSmartCardAuth } from '@vx/libs/auth/test-utils';
import { type DippedSmartCardAuthApi } from '@vx/libs/auth/dipped-cards';
import {
  mockElectionManagerUser,
  mockSessionExpiresAt,
  mockSystemAdministratorUser,
  mockOf,
  zipFile,
} from '@vx/libs/test-utils/src';
import {
  DEFAULT_SYSTEM_SETTINGS,
  type Election,
  type ElectionDefinition,
  ElectionPackageFileName,
  type SystemSettings,
  constructElectionKey,
  DippedSmartCardAuth,
} from '@vx/libs/types/elections';
import { Buffer } from 'node:buffer';
import tmp, { tmpNameSync } from 'tmp';
import {
  generateElectionBasedSubfolderName,
  SCANNER_RESULTS_FOLDER,
} from '@vx/libs/utils/src';
import { createMockUsbDrive, MockUsbDrive } from '@vx/libs/usb-drive/src';
import { writeFileSync } from 'node:fs';
import {
  createMockPrinterHandler,
  MemoryPrinterHandler,
} from '@vx/libs/printing/src/printer';
import { Logger, mockBaseLogger, mockLogger } from '@vx/libs/logging/src';
import { LogSource } from '@vx/libs/logging/src/base_types';
import { type Api, buildApi } from '../app/app';
import { createWorkspace, type Workspace } from '../workspace/workspace';
import { deleteTmpFileAfterTestSuiteCompletes } from './cleanup';
import { getUserRole } from '../util/auth/auth';

type ActualDirectory = string;
type MockFileTree = MockFile | MockDirectory | ActualDirectory;
type MockFile = Buffer;
interface MockDirectory {
  [name: string]: MockFileTree;
}

export function mockCastVoteRecordFileTree(
  electionDefinition: ElectionDefinition,
  mockDirectory: MockDirectory
): MockFileTree {
  const { election, ballotHash } = electionDefinition;
  return {
    [generateElectionBasedSubfolderName(election, ballotHash)]: {
      [SCANNER_RESULTS_FOLDER]: mockDirectory,
    },
  };
}

export function mockAuthStatus(
  auth: DippedSmartCardAuthApi,
  authStatus: DippedSmartCardAuth.AuthStatus
): void {
  const mockGetAuthStatus = mockOf(auth.getAuthStatus);
  mockGetAuthStatus.mockResolvedValue(authStatus);
}

export function mockMachineLocked(auth: DippedSmartCardAuthApi): void {
  mockAuthStatus(auth, {
    status: 'logged_out',
    reason: 'machine_locked',
  });
}

export function mockSystemAdministratorAuth(
  auth: DippedSmartCardAuthApi
): void {
  mockAuthStatus(auth, {
    status: 'logged_in',
    user: mockSystemAdministratorUser(),
    sessionExpiresAt: mockSessionExpiresAt(),
    programmableCard: { status: 'no_card' },
  });
}

export function mockElectionManagerAuth(
  auth: DippedSmartCardAuthApi,
  election: Election
): void {
  mockAuthStatus(auth, {
    status: 'logged_in',
    user: mockElectionManagerUser({
      electionKey: constructElectionKey(election),
    }),
    sessionExpiresAt: mockSessionExpiresAt(),
  });
}

export function saveTmpFile(
  contents: string | Buffer,
  extension?: string
): string {
  const tmpFilePath = tmpNameSync({ postfix: extension });
  writeFileSync(tmpFilePath, contents);
  deleteTmpFileAfterTestSuiteCompletes(tmpFilePath);
  return tmpFilePath;
}

// For now, returns electionId for client calls that still need it
export async function configureMachine(
  api: Api,
  auth: DippedSmartCardAuthApi,
  electionDefinition: ElectionDefinition,
  systemSettings: SystemSettings = DEFAULT_SYSTEM_SETTINGS
): Promise<string> {
  mockSystemAdministratorAuth(auth);
  const electionPackage = await zipFile({
    [ElectionPackageFileName.ELECTION]: electionDefinition.electionData,
    [ElectionPackageFileName.SYSTEM_SETTINGS]: JSON.stringify(systemSettings),
  });
  const electionFilePath = saveTmpFile(electionPackage);
  const { electionId } = (
    await api.configure({ electionFilePath })
  ).unsafeUnwrap();
  return electionId;
}

export function buildMockLogger(
  auth: DippedSmartCardAuthApi,
  workspace: Workspace
): Logger {
  return mockLogger(LogSource.VxAdminService, () =>
    getUserRole(auth, workspace)
  );
}

export interface TestEnv {
  logger: Logger;
  auth: jest.Mocked<DippedSmartCardAuthApi>;
  workspace: Workspace;
  api: Api;
  mockUsbDrive: MockUsbDrive;
  mockPrinterHandler: MemoryPrinterHandler;
}

export function buildTestEnvironment(workspaceRoot?: string): TestEnv {
  const auth = buildMockDippedSmartCardAuth();
  const resolvedWorkspaceRoot =
    workspaceRoot ||
    (() => {
      const defaultWorkspaceRoot = tmp.dirSync().name;
      deleteTmpFileAfterTestSuiteCompletes(defaultWorkspaceRoot);
      return defaultWorkspaceRoot;
    })();
  const workspace = createWorkspace(resolvedWorkspaceRoot, mockBaseLogger());
  const logger = buildMockLogger(auth, workspace);
  const mockUsbDrive = createMockUsbDrive();
  const mockPrinterHandler = createMockPrinterHandler();
  const api = buildApi({
    auth,
    workspace,
    logger,
    usbDrive: mockUsbDrive.usbDrive,
    printer: mockPrinterHandler.printer,
  });

  mockMachineLocked(auth);

  return {
    logger,
    auth,
    workspace,
    api,
    mockUsbDrive,
    mockPrinterHandler,
  };
}
