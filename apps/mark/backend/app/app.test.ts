jest.mock('@vx/libs/utils/src', (): typeof import('@vx/libs/utils/src') => {
  return {
    ...jest.requireActual('@vx/libs/utils/src'),
    isFeatureFlagEnabled: (flag) => mockFeatureFlagger.isEnabled(flag),
    randomBallotId: () => '12345',
  };
});

jest.mock('../devices/accessible_controller');

import { assert } from '@vx/libs/basics/assert';
import * as electionGeneral from '@vx/libs/fixtures/src/data/electionGeneral/election.json';
import * as electionTwoPartyPrimaryFixtures from '@vx/libs/fixtures/src/data/electionTwoPartyPrimary';
import {
  mockElectionManagerUser,
  mockPollWorkerUser,
  mockSessionExpiresAt,
  mockOf,
  suppressingConsoleOutput,
} from '@vx/libs/test-utils/src';
import { type InsertedSmartCardAuthApi } from '@vx/libs/auth/inserted-cards';
import {
  DEFAULT_SYSTEM_SETTINGS,
  type ElectionDefinition,
  constructElectionKey,
} from '@vx/libs/types/elections';
import { safeParseElectionDefinition } from '@vx/libs/types/election-parsing';
import { type PrinterStatus } from '@vx/libs/types/printing';
import { LanguageCode } from '@vx/libs/types/languages';
import { convertVxfElectionToCdfBallotDefinition } from '@vx/libs/types/cdf';
import { type UiStringsPackage } from '@vx/libs/types/ui_strings';
import {
  ALL_PRECINCTS_SELECTION,
  ELECTION_PACKAGE_FOLDER,
  BooleanEnvironmentVariableName,
  getFeatureFlagMock,
  singlePrecinctSelectionFor,
  generateMockVotes,
  getMockMultiLanguageElectionDefinition,
} from '@vx/libs/utils/src';

import { Buffer } from 'node:buffer';
import { mockElectionPackageFileTree } from '@vx/libs/backend/election_package';
import { Server } from 'node:http';
import * as grout from '@vx/libs/grout/src';
import { type MockUsbDrive } from '@vx/libs/usb-drive/src';
import { LogEventId, Logger } from '@vx/libs/logging/src';
import {
  HP_LASER_PRINTER_CONFIG,
  type MemoryPrinterHandler,
} from '@vx/libs/printing/src/printer';
import { createApp } from '../test/app_helpers';
import { type Api } from './app';
import { type ElectionState } from '../types/types';
import { isAccessibleControllerAttached } from '../devices/accessible_controller';
import '@vx/libs/image-test-utils/register';
import { uiStringsPackage } from '@vx/libs/fixtures/ui_strings/ui_strings_package';

const electionDefinition = electionGeneral.toElectionDefinition();

const mockFeatureFlagger = getFeatureFlagMock();

let apiClient: grout.Client<Api>;
let logger: Logger;
let mockAuth: InsertedSmartCardAuthApi;
let mockUsbDrive: MockUsbDrive;
let mockPrinterHandler: MemoryPrinterHandler;
let server: Server;

function mockElectionManagerAuth(definition: ElectionDefinition) {
  mockOf(mockAuth.getAuthStatus).mockImplementation(() =>
    Promise.resolve({
      status: 'logged_in',
      user: mockElectionManagerUser({
        electionKey: constructElectionKey(definition.election),
      }),
      sessionExpiresAt: mockSessionExpiresAt(),
    })
  );
}

function mockPollWorkerAuth(definition: ElectionDefinition) {
  mockOf(mockAuth.getAuthStatus).mockImplementation(() =>
    Promise.resolve({
      status: 'logged_in',
      user: mockPollWorkerUser({
        electionKey: constructElectionKey(definition.election),
      }),
      sessionExpiresAt: mockSessionExpiresAt(),
    })
  );
}

function mockNoCard() {
  mockOf(mockAuth.getAuthStatus).mockImplementation(() =>
    Promise.resolve({
      status: 'logged_out',
      reason: 'no_card',
    })
  );
}

beforeEach(() => {
  mockFeatureFlagger.enableFeatureFlag(
    BooleanEnvironmentVariableName.SKIP_ELECTION_PACKAGE_AUTHENTICATION
  );

  ({ apiClient, mockAuth, mockUsbDrive, mockPrinterHandler, server, logger } =
    createApp());
});

afterEach(() => {
  server?.close();
});

test('uses machine config from env', async () => {
  const originalEnv = process.env;
  process.env = {
    ...originalEnv,
    VX_MACHINE_ID: 'test-machine-id',
    VX_CODE_VERSION: 'test-code-version',
    VX_SCREEN_ORIENTATION: 'landscape',
  };

  expect(await apiClient.getMachineConfig()).toEqual({
    machineId: 'test-machine-id',
    codeVersion: 'test-code-version',
    screenOrientation: 'landscape',
  });

  process.env = originalEnv;
});

test('uses default machine config if not set', async () => {
  expect(await apiClient.getMachineConfig()).toEqual({
    machineId: '0000',
    codeVersion: 'dev',
    screenOrientation: 'portrait',
  });
});

test('configureElectionPackageFromUsb reads to and writes from store', async () => {
  mockElectionManagerAuth(electionDefinition);

  mockUsbDrive.insertUsbDrive(
    await mockElectionPackageFileTree({
      electionDefinition,
      systemSettings: DEFAULT_SYSTEM_SETTINGS,
    })
  );

  const writeResult = await apiClient.configureElectionPackageFromUsb();
  assert(writeResult.isOk());
  expect(logger.logAsCurrentRole).toHaveBeenLastCalledWith(
    LogEventId.ElectionConfigured,
    expect.objectContaining({
      disposition: 'success',
    })
  );

  const readResult = await apiClient.getSystemSettings();
  expect(readResult).toEqual(DEFAULT_SYSTEM_SETTINGS);
  const electionRecord = await apiClient.getElectionRecord();
  expect(electionRecord).toEqual({
    electionDefinition,
    electionPackageHash: expect.any(String),
  });
});

test('unconfigureMachine deletes system settings and election definition', async () => {
  mockElectionManagerAuth(electionDefinition);

  mockUsbDrive.insertUsbDrive(
    await mockElectionPackageFileTree({
      electionDefinition,
      systemSettings: DEFAULT_SYSTEM_SETTINGS,
    })
  );

  const writeResult = await apiClient.configureElectionPackageFromUsb();
  assert(writeResult.isOk());
  await apiClient.unconfigureMachine();
  expect(logger.logAsCurrentRole).toHaveBeenLastCalledWith(
    LogEventId.ElectionUnconfigured,
    expect.objectContaining({
      disposition: 'success',
    })
  );

  const readResult = await apiClient.getSystemSettings();
  expect(readResult).toEqual(DEFAULT_SYSTEM_SETTINGS);
  const electionRecord = await apiClient.getElectionRecord();
  expect(electionRecord).toBeNull();
});

test('configureElectionPackageFromUsb throws when no USB drive mounted', async () => {
  mockElectionManagerAuth(electionDefinition);

  mockUsbDrive.usbDrive.status
    .expectCallWith()
    .resolves({ status: 'no_drive' });
  await suppressingConsoleOutput(async () => {
    await expect(apiClient.configureElectionPackageFromUsb()).rejects.toThrow(
      'No USB drive mounted'
    );
  });
});

test('configureElectionPackageFromUsb returns an error if election package parsing fails', async () => {
  // Lack of auth will cause election package reading to throw
  mockOf(mockAuth.getAuthStatus).mockImplementation(() =>
    Promise.resolve({
      status: 'logged_out',
      reason: 'no_card',
    })
  );

  mockUsbDrive.insertUsbDrive({
    'some-election': {
      [ELECTION_PACKAGE_FOLDER]: {
        'test-election-package.zip': Buffer.from("doesn't matter"),
      },
    },
  });

  const result = await apiClient.configureElectionPackageFromUsb();
  assert(result.isErr());
  expect(result.err()).toEqual('auth_required_before_election_package_load');
  expect(logger.logAsCurrentRole).toHaveBeenLastCalledWith(
    LogEventId.ElectionConfigured,
    expect.objectContaining({
      disposition: 'failure',
    })
  );
});

test('configure with CDF election', async () => {
  const cdfElection = convertVxfElectionToCdfBallotDefinition(
    electionGeneral.election
  );
  const cdfElectionDefinition = safeParseElectionDefinition(
    JSON.stringify(cdfElection)
  ).unsafeUnwrap();
  mockElectionManagerAuth(cdfElectionDefinition);

  mockUsbDrive.insertUsbDrive(
    await mockElectionPackageFileTree({
      electionDefinition: cdfElectionDefinition,
      systemSettings: DEFAULT_SYSTEM_SETTINGS,
    })
  );

  (await apiClient.configureElectionPackageFromUsb()).unsafeUnwrap();

  const electionRecord = await apiClient.getElectionRecord();
  expect(electionRecord?.electionDefinition.election.id).toEqual(
    electionGeneral.election.id
  );

  // Ensure loading auth election key from db works
  expect(await apiClient.getAuthStatus()).toMatchObject({
    status: 'logged_in',
  });
});

test('usbDrive', async () => {
  const { usbDrive } = mockUsbDrive;

  usbDrive.status.expectCallWith().resolves({ status: 'no_drive' });
  expect(await apiClient.getUsbDriveStatus()).toEqual({
    status: 'no_drive',
  });

  usbDrive.eject.expectCallWith().resolves();
  await apiClient.ejectUsbDrive();

  mockElectionManagerAuth(electionDefinition);
  usbDrive.eject.expectCallWith().resolves();
  await apiClient.ejectUsbDrive();
});

async function expectElectionState(expected: Partial<ElectionState>) {
  expect(await apiClient.getElectionState()).toMatchObject(expected);
}

async function configureMachine(
  usbDrive: MockUsbDrive,
  definition: ElectionDefinition,
  uiStrings?: UiStringsPackage
) {
  mockElectionManagerAuth(definition);

  usbDrive.insertUsbDrive(
    await mockElectionPackageFileTree({
      electionDefinition: definition,
      systemSettings: DEFAULT_SYSTEM_SETTINGS,
      uiStrings,
    })
  );

  const writeResult = await apiClient.configureElectionPackageFromUsb();
  assert(writeResult.isOk());

  usbDrive.removeUsbDrive();
  mockNoCard();
}

test('single precinct election automatically has precinct set on configure', async () => {
  await configureMachine(
    mockUsbDrive,
    electionTwoPartyPrimaryFixtures.asSinglePrecinctElectionDefinition()
  );

  await expectElectionState({
    precinctSelection: singlePrecinctSelectionFor('precinct-1'),
  });
});

test('polls state', async () => {
  await expectElectionState({ pollsState: 'polls_closed_initial' });

  await configureMachine(mockUsbDrive, electionDefinition);
  await expectElectionState({ pollsState: 'polls_closed_initial' });

  mockPollWorkerAuth(electionDefinition);
  await apiClient.setPollsState({ pollsState: 'polls_open' });
  expect(logger.log).toHaveBeenLastCalledWith(
    LogEventId.PollsOpened,
    'poll_worker',
    { disposition: 'success' }
  );
  await expectElectionState({ pollsState: 'polls_open' });

  await apiClient.setPollsState({ pollsState: 'polls_paused' });
  expect(logger.log).toHaveBeenLastCalledWith(
    LogEventId.VotingPaused,
    'poll_worker',
    { disposition: 'success' }
  );
  await expectElectionState({ pollsState: 'polls_paused' });

  await apiClient.setPollsState({ pollsState: 'polls_open' });
  expect(logger.log).toHaveBeenLastCalledWith(
    LogEventId.VotingResumed,
    'poll_worker',
    { disposition: 'success' }
  );
  await expectElectionState({ pollsState: 'polls_open' });

  await apiClient.setPollsState({ pollsState: 'polls_closed_final' });
  expect(logger.log).toHaveBeenLastCalledWith(
    LogEventId.PollsClosed,
    'poll_worker',
    { disposition: 'success' }
  );
  await expectElectionState({ pollsState: 'polls_closed_final' });

  // system admin resetting polls to paused
  await apiClient.setPollsState({ pollsState: 'polls_paused' });
  await expectElectionState({ pollsState: 'polls_paused' });
});

test('test mode', async () => {
  await expectElectionState({ isTestMode: true });

  await configureMachine(mockUsbDrive, electionDefinition);

  await apiClient.setTestMode({ isTestMode: false });
  await expectElectionState({ isTestMode: false });

  await apiClient.setTestMode({ isTestMode: true });
  await expectElectionState({ isTestMode: true });
});

test('setting precinct', async () => {
  expect(
    (await apiClient.getElectionState()).precinctSelection
  ).toBeUndefined();

  await configureMachine(mockUsbDrive, electionDefinition);
  expect(
    (await apiClient.getElectionState()).precinctSelection
  ).toBeUndefined();

  await apiClient.setPrecinctSelection({
    precinctSelection: ALL_PRECINCTS_SELECTION,
  });
  await expectElectionState({
    precinctSelection: ALL_PRECINCTS_SELECTION,
  });

  const singlePrecinctSelection = singlePrecinctSelectionFor('23');
  await apiClient.setPrecinctSelection({
    precinctSelection: singlePrecinctSelection,
  });
  await expectElectionState({
    precinctSelection: singlePrecinctSelection,
  });
  expect(logger.logAsCurrentRole).toHaveBeenLastCalledWith(
    LogEventId.PrecinctConfigurationChanged,
    {
      disposition: 'success',
      message: 'User set the precinct for the machine to Center Springfield',
    }
  );
});

test('printer status', async () => {
  expect(await apiClient.getPrinterStatus()).toEqual<PrinterStatus>({
    connected: false,
  });

  mockPrinterHandler.connectPrinter(HP_LASER_PRINTER_CONFIG);
  expect(await apiClient.getPrinterStatus()).toMatchObject<PrinterStatus>({
    connected: true,
    config: HP_LASER_PRINTER_CONFIG,
  });

  mockPrinterHandler.disconnectPrinter();
  expect(await apiClient.getPrinterStatus()).toEqual<PrinterStatus>({
    connected: false,
  });
});

test('printing ballots', async () => {
  const multiLanguageElectionDef = getMockMultiLanguageElectionDefinition(
    electionDefinition,
    [LanguageCode.ENGLISH, LanguageCode.CHINESE_SIMPLIFIED]
  );
  mockPrinterHandler.connectPrinter(HP_LASER_PRINTER_CONFIG);
  await configureMachine(
    mockUsbDrive,
    multiLanguageElectionDef,
    uiStringsPackage
  );

  await expectElectionState({ ballotsPrintedCount: 0 });

  // vote a ballot in English
  const mockVotes = generateMockVotes(multiLanguageElectionDef.election);
  await apiClient.printBallot({
    precinctId: '21',
    ballotStyleId: multiLanguageElectionDef.election.ballotStyles.find(
      (bs) => bs.languages?.includes(LanguageCode.ENGLISH)
    )!.id,
    votes: mockVotes,
    languageCode: LanguageCode.ENGLISH,
  });

  await expectElectionState({ ballotsPrintedCount: 1 });
  await expect(mockPrinterHandler.getLastPrintPath()).toMatchPdfSnapshot({
    customSnapshotIdentifier: 'english-ballot',
    failureThreshold: 0.03,
  });

  // vote a ballot in Chinese
  await apiClient.printBallot({
    precinctId: '21',
    ballotStyleId: multiLanguageElectionDef.election.ballotStyles.find(
      (bs) => bs.languages?.includes(LanguageCode.CHINESE_SIMPLIFIED)
    )!.id,
    votes: mockVotes,
    languageCode: LanguageCode.CHINESE_SIMPLIFIED,
  });

  await expectElectionState({ ballotsPrintedCount: 2 });
  await expect(mockPrinterHandler.getLastPrintPath()).toMatchPdfSnapshot({
    customSnapshotIdentifier: 'chinese-ballot',
    failureThreshold: 0.03,
  });
});

test('getAccessibleControllerConnected', async () => {
  const isAccessibleControllerAttachedMock = mockOf(
    isAccessibleControllerAttached
  );

  isAccessibleControllerAttachedMock.mockReturnValue(true);
  expect(await apiClient.getAccessibleControllerConnected()).toEqual(true);

  isAccessibleControllerAttachedMock.mockReturnValue(false);
  expect(await apiClient.getAccessibleControllerConnected()).toEqual(false);
});
