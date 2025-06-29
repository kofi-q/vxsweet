jest.mock('../pat-input/connection_status_reader');

jest.mock('@vx/libs/utils/src', (): typeof import('@vx/libs/utils/src') => {
  return {
    ...jest.requireActual('@vx/libs/utils/src'),
    isFeatureFlagEnabled: (flag: BooleanEnvironmentVariableName) =>
      featureFlagMock.isEnabled(flag),
    randomBallotId: () => '12345',
  };
});

import { assert } from '@vx/libs/basics/assert';
import { deferred } from '@vx/libs/basics/async';
import { mapObject } from '@vx/libs/basics/objects';
import tmp from 'tmp';
import * as electionGeneralFixtures from '@vx/libs/fixtures/src/data/electionGeneral';
import * as electionTwoPartyPrimaryFixtures from '@vx/libs/fixtures/src/data/electionTwoPartyPrimary';
import { mockOf, suppressingConsoleOutput } from '@vx/libs/test-utils/src';
import { type InsertedSmartCardAuthApi } from '@vx/libs/auth/inserted-cards';
import {
  ALL_PRECINCTS_SELECTION,
  ELECTION_PACKAGE_FOLDER,
  BooleanEnvironmentVariableName,
  getFeatureFlagMock,
  generateMockVotes,
  singlePrecinctSelectionFor,
  getMockMultiLanguageElectionDefinition,
} from '@vx/libs/utils/src';
import { Buffer } from 'node:buffer';
import { mockElectionPackageFileTree } from '@vx/libs/backend/election_package';
import { Server } from 'node:http';
import * as grout from '@vx/libs/grout/src';
import {
  type BallotStyleId,
  type CandidateVote,
  DEFAULT_SYSTEM_SETTINGS,
  type ElectionDefinition,
  type VotesDict,
} from '@vx/libs/types/elections';
import { safeParseElectionDefinition } from '@vx/libs/types/election-parsing';
import { LanguageCode } from '@vx/libs/types/languages';
import { convertVxfElectionToCdfBallotDefinition } from '@vx/libs/types/cdf';
import { type UiStringsPackage } from '@vx/libs/types/ui_strings';
import { type MockUsbDrive } from '@vx/libs/usb-drive/src';
import { MockPaperHandlerDriver } from '@vx/libs/custom-paper-handler/src/driver';
import { LogEventId, Logger, mockBaseLogger } from '@vx/libs/logging/src';
import { AddressInfo } from 'node:net';
import { SimulatedClock } from 'xstate/lib/SimulatedClock';
import {
  createApp,
  waitForStatus as waitForStatusHelper,
} from '../test/app_helpers';
import { type Api, buildApp } from './app';
import {
  ACCEPTED_PAPER_TYPES,
  delays,
  type PaperHandlerStateMachine,
} from '../custom-paper-handler/state_machine';
import { type ElectionState } from '../types/types';
import {
  mockCardlessVoterAuth,
  mockElectionManagerAuth,
  mockPollWorkerAuth,
} from '../test/auth_helpers';
import { PatConnectionStatusReader } from '../pat-input/connection_status_reader';
import { createWorkspace } from '../util/workspace';
import '@vx/libs/image-test-utils/register';
import { uiStringsPackage } from '@vx/libs/fixtures/src/data/electionGeneral/ui-strings.json';

const TEST_POLLING_INTERVAL_MS = 15;

const featureFlagMock = getFeatureFlagMock();

let apiClient: grout.Client<Api>;
let mockAuth: InsertedSmartCardAuthApi;
let mockUsbDrive: MockUsbDrive;
let server: Server;
let stateMachine: PaperHandlerStateMachine;
let driver: MockPaperHandlerDriver;
let patConnectionStatusReader: PatConnectionStatusReader;
let logger: Logger;
let clock: SimulatedClock;

beforeEach(async () => {
  featureFlagMock.enableFeatureFlag(
    BooleanEnvironmentVariableName.SKIP_ELECTION_PACKAGE_AUTHENTICATION
  );
  featureFlagMock.enableFeatureFlag(
    BooleanEnvironmentVariableName.USE_MOCK_PAPER_HANDLER
  );
  featureFlagMock.enableFeatureFlag(
    BooleanEnvironmentVariableName.MARK_SCAN_DISABLE_BALLOT_REINSERTION
  );

  const mockWorkspaceDir = tmp.dirSync();
  patConnectionStatusReader = new PatConnectionStatusReader(
    logger,
    'bmd-150',
    mockWorkspaceDir.name
  );
  mockOf(patConnectionStatusReader.isPatDeviceConnected).mockResolvedValue(
    false
  );

  const result = await createApp({
    patConnectionStatusReader,
    pollingIntervalMs: TEST_POLLING_INTERVAL_MS,
  });
  apiClient = result.apiClient;
  logger = result.logger;
  mockAuth = result.mockAuth;
  mockUsbDrive = result.mockUsbDrive;
  server = result.server;
  stateMachine = result.stateMachine;
  driver = result.driver;
  clock = result.clock;
});

afterEach(async () => {
  featureFlagMock.resetFeatureFlags();
  await stateMachine.cleanUp();
  server.close();
});

async function waitForStatus(status: string): Promise<void> {
  await waitForStatusHelper(apiClient, TEST_POLLING_INTERVAL_MS, status);
}

async function setUpUsbAndConfigureElection(
  electionDefinition: ElectionDefinition,
  uiStrings?: UiStringsPackage
) {
  mockElectionManagerAuth(mockAuth, electionDefinition);
  mockUsbDrive.insertUsbDrive(
    await mockElectionPackageFileTree({
      electionDefinition,
      systemSettings: DEFAULT_SYSTEM_SETTINGS,
      uiStrings,
    })
  );

  const writeResult = await apiClient.configureElectionPackageFromUsb();
  assert(
    writeResult.isOk(),
    `Failed to configure election package from USB with error ${writeResult.err()}`
  );
}

async function configureForTestElection(
  electionDefinition: ElectionDefinition,
  uiStrings?: UiStringsPackage
) {
  await setUpUsbAndConfigureElection(electionDefinition, uiStrings);
  await apiClient.setPrecinctSelection({
    precinctSelection: singlePrecinctSelectionFor(
      electionDefinition.election.precincts[1].id
    ),
  });
}

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
  const electionDefinition =
    electionGeneralFixtures.electionJson.toElectionDefinition();

  mockElectionManagerAuth(mockAuth, electionDefinition);
  await setUpUsbAndConfigureElection(electionDefinition);
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
  const electionDefinition =
    electionGeneralFixtures.electionJson.toElectionDefinition();

  mockElectionManagerAuth(mockAuth, electionDefinition);
  mockElectionManagerAuth(mockAuth, electionDefinition);
  let readResult = await apiClient.getSystemSettings();
  expect(readResult).toEqual(DEFAULT_SYSTEM_SETTINGS);

  await setUpUsbAndConfigureElection(electionDefinition);
  await apiClient.unconfigureMachine();
  expect(logger.logAsCurrentRole).toHaveBeenLastCalledWith(
    LogEventId.ElectionUnconfigured,
    expect.objectContaining({
      disposition: 'success',
    })
  );

  readResult = await apiClient.getSystemSettings();
  expect(readResult).toEqual(DEFAULT_SYSTEM_SETTINGS);
  const electionDefinitionResult = await apiClient.getElectionRecord();
  expect(electionDefinitionResult).toBeNull();
});

test('configureElectionPackageFromUsb throws when no USB drive mounted', async () => {
  const electionDefinition =
    electionGeneralFixtures.electionJson.toElectionDefinition();
  mockElectionManagerAuth(mockAuth, electionDefinition);

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
    electionGeneralFixtures.electionJson.election
  );
  const cdfElectionDefinition = safeParseElectionDefinition(
    JSON.stringify(cdfElection)
  ).unsafeUnwrap();
  mockElectionManagerAuth(mockAuth, cdfElectionDefinition);
  await setUpUsbAndConfigureElection(cdfElectionDefinition);

  const electionRecord = await apiClient.getElectionRecord();
  expect(electionRecord?.electionDefinition.election.id).toEqual(
    electionGeneralFixtures.electionJson.election.id
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

  mockElectionManagerAuth(
    mockAuth,
    electionGeneralFixtures.electionJson.toElectionDefinition()
  );
  usbDrive.eject.expectCallWith().resolves();
  await apiClient.ejectUsbDrive();
});

async function expectElectionState(expected: Partial<ElectionState>) {
  expect(await apiClient.getElectionState()).toMatchObject(expected);
}

test('single precinct election automatically has precinct set on configure', async () => {
  await setUpUsbAndConfigureElection(
    electionTwoPartyPrimaryFixtures.asSinglePrecinctElectionDefinition()
  );

  await expectElectionState({
    precinctSelection: singlePrecinctSelectionFor('precinct-1'),
  });
});

test('polls state', async () => {
  await expectElectionState({ pollsState: 'polls_closed_initial' });

  await setUpUsbAndConfigureElection(
    electionGeneralFixtures.electionJson.toElectionDefinition()
  );
  await expectElectionState({ pollsState: 'polls_closed_initial' });

  mockPollWorkerAuth(
    mockAuth,
    electionGeneralFixtures.electionJson.toElectionDefinition()
  );
  await apiClient.setPollsState({ pollsState: 'polls_open' });
  expect(logger.log).toHaveBeenCalledWith(
    LogEventId.PollsOpened,
    'poll_worker',
    { disposition: 'success' }
  );
  await expectElectionState({ pollsState: 'polls_open' });

  await apiClient.setPollsState({ pollsState: 'polls_paused' });
  expect(logger.log).toHaveBeenCalledWith(
    LogEventId.VotingPaused,
    'poll_worker',
    { disposition: 'success' }
  );
  await expectElectionState({ pollsState: 'polls_paused' });

  await apiClient.setPollsState({ pollsState: 'polls_open' });
  expect(logger.log).toHaveBeenCalledWith(
    LogEventId.VotingResumed,
    'poll_worker',
    { disposition: 'success' }
  );
  await expectElectionState({ pollsState: 'polls_open' });

  await apiClient.setPollsState({ pollsState: 'polls_closed_final' });
  expect(logger.log).toHaveBeenCalledWith(
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

  await setUpUsbAndConfigureElection(
    electionGeneralFixtures.electionJson.toElectionDefinition()
  );
  expect(logger.logAsCurrentRole).toHaveBeenCalledTimes(1);

  await apiClient.setTestMode({ isTestMode: false });
  await expectElectionState({ isTestMode: false });
  expect(logger.logAsCurrentRole).toHaveBeenCalledTimes(3);
  expect(logger.logAsCurrentRole).toHaveBeenLastCalledWith(
    LogEventId.ToggledTestMode,
    {
      disposition: 'success',
      message: expect.anything(),
      isTestMode: false,
    }
  );

  await apiClient.setTestMode({ isTestMode: true });
  await expectElectionState({ isTestMode: true });
  expect(logger.logAsCurrentRole).toHaveBeenCalledTimes(5);
});

test('setting precinct', async () => {
  expect(
    (await apiClient.getElectionState()).precinctSelection
  ).toBeUndefined();

  await setUpUsbAndConfigureElection(
    electionGeneralFixtures.electionJson.toElectionDefinition()
  );
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
  expect(logger.logAsCurrentRole).toHaveBeenCalledWith(
    LogEventId.PrecinctConfigurationChanged,
    {
      disposition: 'success',
      message: 'User set the precinct for the machine to Center Springfield',
    }
  );
});

test('empty ballot box requires poll worker auth', async () => {
  await configureForTestElection(
    electionGeneralFixtures.electionJson.toElectionDefinition()
  );

  await suppressingConsoleOutput(async () => {
    await expect(apiClient.confirmBallotBoxEmptied()).rejects.toThrow(
      'Expected pollworker auth'
    );
  });
});

test('empty ballot box', async () => {
  await configureForTestElection(
    electionGeneralFixtures.electionJson.toElectionDefinition()
  );
  mockPollWorkerAuth(
    mockAuth,
    electionGeneralFixtures.electionJson.toElectionDefinition()
  );

  await apiClient.confirmBallotBoxEmptied();
  expect(logger.log).toHaveBeenCalledWith(
    LogEventId.BallotBoxEmptied,
    'poll_worker'
  );
});

test('getPaperHandlerState returns state machine state', async () => {
  await configureForTestElection(
    electionGeneralFixtures.electionJson.toElectionDefinition()
  );
  await apiClient.setAcceptingPaperState({ paperTypes: ACCEPTED_PAPER_TYPES });
  expect(await apiClient.getPaperHandlerState()).toEqual('accepting_paper');
});

test('getInterpretation returns null if no interpretation is stored on the state machine', async () => {
  expect(await apiClient.getInterpretation()).toEqual(null);
});

async function mockLoadFlow(
  testApiClient: grout.Client<Api>,
  testDriver: MockPaperHandlerDriver
) {
  await testApiClient.setAcceptingPaperState({
    paperTypes: ACCEPTED_PAPER_TYPES,
  });
  await waitForStatus('accepting_paper');

  testDriver.setMockStatus('paperInserted');
  clock.increment(delays.DELAY_PAPER_HANDLER_STATUS_POLLING_INTERVAL_MS);
  await waitForStatus('loading_paper');

  mockCardlessVoterAuth(mockAuth);
  clock.increment(delays.DELAY_AUTH_STATUS_POLLING_INTERVAL_MS);
  await waitForStatus('waiting_for_ballot_data');
}

async function mockLoadAndPrint(
  testApiClient: grout.Client<Api>,
  testDriver: MockPaperHandlerDriver
) {
  await mockLoadFlow(testApiClient, testDriver);
  await testApiClient.printBallot({
    languageCode: LanguageCode.ENGLISH,
    precinctId: '21',
    ballotStyleId: '12' as BallotStyleId,
    votes: {},
  });
  clock.increment(delays.DELAY_PAPER_HANDLER_STATUS_POLLING_INTERVAL_MS);
  await waitForStatus('presenting_ballot');
}

test('ballot invalidation flow', async () => {
  await configureForTestElection(
    electionGeneralFixtures.electionJson.toElectionDefinition()
  );
  await mockLoadAndPrint(apiClient, driver);
  await apiClient.invalidateBallot();
  mockPollWorkerAuth(
    mockAuth,
    electionGeneralFixtures.electionJson.toElectionDefinition()
  );
  await waitForStatus(
    'waiting_for_invalidated_ballot_confirmation.paper_present'
  );

  driver.setMockStatus('noPaper');
  clock.increment(delays.DELAY_PAPER_HANDLER_STATUS_POLLING_INTERVAL_MS);
  await waitForStatus(
    'waiting_for_invalidated_ballot_confirmation.paper_absent'
  );
  await apiClient.confirmInvalidateBallot();
  await waitForStatus('accepting_paper');
});

test('ballot validation flow', async () => {
  const deferredEjection = deferred<boolean>();
  const mockEject = jest.spyOn(driver, 'ejectBallotToRear');
  mockEject.mockReturnValue(deferredEjection.promise);

  await configureForTestElection(
    electionGeneralFixtures.electionJson.toElectionDefinition()
  );
  await mockLoadAndPrint(apiClient, driver);
  await apiClient.validateBallot();
  await waitForStatus('ejecting_to_rear');

  deferredEjection.resolve(true);
});

test('removing ballot during presentation', async () => {
  await configureForTestElection(
    electionGeneralFixtures.electionJson.toElectionDefinition()
  );
  await mockLoadAndPrint(apiClient, driver);

  driver.setMockStatus('noPaper');
  clock.increment(delays.DELAY_PAPER_HANDLER_STATUS_POLLING_INTERVAL_MS);
  await waitForStatus('ballot_removed_during_presentation');

  await apiClient.confirmSessionEnd();
  clock.increment(delays.DELAY_AUTH_STATUS_POLLING_INTERVAL_MS);
  await waitForStatus('not_accepting_paper');
});

test('setPatDeviceIsCalibrated', async () => {
  await configureForTestElection(
    electionGeneralFixtures.electionJson.toElectionDefinition()
  );
  await mockLoadFlow(apiClient, driver);
  expect(await apiClient.getPaperHandlerState()).toEqual(
    'waiting_for_ballot_data'
  );
  mockOf(patConnectionStatusReader.isPatDeviceConnected).mockResolvedValue(
    true
  );
  clock.increment(delays.DELAY_PAT_CONNECTION_STATUS_POLLING_INTERVAL_MS);
  await waitForStatus('pat_device_connected');

  await apiClient.setPatDeviceIsCalibrated();
  await waitForStatus('waiting_for_ballot_data');
});

function sortVotes(votes: VotesDict): VotesDict {
  return mapObject(votes, (vote) => {
    assert(vote);

    if (typeof vote[0] === 'object') {
      return (vote as CandidateVote)
        .slice()
        .sort((a, b) => a.id.localeCompare(b.id));
    }

    return vote.slice().sort();
  });
}

function expectVotesEqual(expected: VotesDict, actual: VotesDict) {
  expect(sortVotes(actual)).toEqual(sortVotes(expected));
}

test('printing ballots', async () => {
  const printBallotSpy = jest.spyOn(stateMachine, 'printBallot');

  const deferredEjection = deferred<boolean>();
  const mockEject = jest.spyOn(driver, 'ejectBallotToRear');
  mockEject.mockReturnValue(deferredEjection.promise);

  const electionDefinition = getMockMultiLanguageElectionDefinition(
    electionGeneralFixtures.electionJson.toElectionDefinition(),
    [LanguageCode.ENGLISH, LanguageCode.CHINESE_SIMPLIFIED]
  );
  await configureForTestElection(electionDefinition, uiStringsPackage);

  await expectElectionState({ ballotsPrintedCount: 0 });

  // vote a ballot in English
  await mockLoadFlow(apiClient, driver);
  const mockVotes = generateMockVotes(electionDefinition.election);
  await apiClient.printBallot({
    precinctId: '21',
    ballotStyleId: electionDefinition.election.ballotStyles.find(
      (bs) => bs.languages?.includes(LanguageCode.ENGLISH)
    )!.id,
    votes: mockVotes,
    languageCode: LanguageCode.ENGLISH,
  });

  await expectElectionState({ ballotsPrintedCount: 1 });
  const pdfData = printBallotSpy.mock.calls[0][0];
  await expect(pdfData).toMatchPdfSnapshot({ failureThreshold: 0.04 });

  await waitForStatus('presenting_ballot');
  const interpretation = await apiClient.getInterpretation();
  assert(interpretation);
  assert(interpretation.type === 'InterpretedBmdPage');
  expectVotesEqual(interpretation.votes, mockVotes);

  await apiClient.validateBallot();
  await waitForStatus('ejecting_to_rear');
  deferredEjection.resolve(true);
  driver.setMockStatus('noPaper');
  clock.increment(delays.DELAY_PAPER_HANDLER_STATUS_POLLING_INTERVAL_MS);
  await waitForStatus('ballot_accepted');

  clock.increment(delays.DELAY_NOTIFICATION_DURATION_MS);
  await waitForStatus('not_accepting_paper');
  mockPollWorkerAuth(mockAuth, electionDefinition);

  // vote a ballot in Chinese
  await mockLoadFlow(apiClient, driver);
  await apiClient.printBallot({
    precinctId: '21',
    ballotStyleId: electionDefinition.election.ballotStyles.find(
      (bs) => bs.languages?.includes(LanguageCode.CHINESE_SIMPLIFIED)
    )!.id,
    votes: mockVotes,
    languageCode: LanguageCode.CHINESE_SIMPLIFIED,
  });

  await expectElectionState({ ballotsPrintedCount: 2 });
  const pdfDataChinese = printBallotSpy.mock.calls[1][0];
  await expect(pdfDataChinese).toMatchPdfSnapshot({ failureThreshold: 0.04 });

  await waitForStatus('presenting_ballot');
  const interpretationChinese = await apiClient.getInterpretation();
  assert(interpretationChinese);
  assert(interpretationChinese.type === 'InterpretedBmdPage');
  expectVotesEqual(interpretationChinese.votes, mockVotes);
});

test('addDiagnosticRecord', async () => {
  await apiClient.addDiagnosticRecord({
    type: 'mark-scan-accessible-controller',
    outcome: 'pass',
    message: 'test message',
  });
  const diagnostic = await apiClient.getMostRecentDiagnostic({
    diagnosticType: 'mark-scan-accessible-controller',
  });
  assert(diagnostic, 'Expected diagnostic to be defined');
  expect(diagnostic.type).toEqual('mark-scan-accessible-controller');
  expect(diagnostic.outcome).toEqual('pass');
  expect(diagnostic.message).toEqual('test message');
});

test('startPaperHandlerDiagnostic fails test if no state machine', async () => {
  const workspace = createWorkspace(tmp.dirSync().name, mockBaseLogger());
  const app = buildApp(mockAuth, logger, workspace, mockUsbDrive.usbDrive);
  const serverNoStateMachine = app.listen();
  const { port } = serverNoStateMachine.address() as AddressInfo;
  const baseUrl = `http://localhost:${port}/api`;

  const apiClientNoStateMachine = grout.createClient<Api>({ baseUrl });
  await apiClientNoStateMachine.startPaperHandlerDiagnostic();
  const diagnostic = await apiClientNoStateMachine.getMostRecentDiagnostic({
    diagnosticType: 'mark-scan-paper-handler',
  });
  expect(diagnostic?.outcome).toEqual('fail');
});
