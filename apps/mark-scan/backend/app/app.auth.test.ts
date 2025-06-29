jest.mock('@vx/libs/utils/src', (): typeof import('@vx/libs/utils/src') => {
  return {
    ...jest.requireActual('@vx/libs/utils/src'),
    isFeatureFlagEnabled: (flag) => mockFeatureFlagger.isEnabled(flag),
  };
});

import { DateTime } from 'luxon';
import * as electionFamousNames2021Fixtures from '@vx/libs/fixtures/src/data/electionFamousNames2021';
import {
  DEFAULT_SYSTEM_SETTINGS,
  type SystemSettings,
  type BallotStyleId,
  constructElectionKey,
  TEST_JURISDICTION,
} from '@vx/libs/types/elections';
import * as grout from '@vx/libs/grout/src';

import { type InsertedSmartCardAuthApi } from '@vx/libs/auth/inserted-cards';
import { Server } from 'node:http';
import { mockOf } from '@vx/libs/test-utils/src';
import {
  BooleanEnvironmentVariableName,
  getFeatureFlagMock,
} from '@vx/libs/utils/src';

import { type MockUsbDrive } from '@vx/libs/usb-drive/src';
import { configureApp, createApp } from '../test/app_helpers';
import { type Api } from './app';
import { type PaperHandlerStateMachine } from '../custom-paper-handler/state_machine';

const jurisdiction = TEST_JURISDICTION;
const election = electionFamousNames2021Fixtures.electionJson.election;
const electionKey = constructElectionKey(election);
const systemSettings: SystemSettings = {
  ...DEFAULT_SYSTEM_SETTINGS,
  auth: {
    arePollWorkerCardPinsEnabled: true,
    inactiveSessionTimeLimitMinutes: 10,
    overallSessionTimeLimitHours: 1,
    numIncorrectPinAttemptsAllowedBeforeCardLockout: 3,
    startingCardLockoutDurationSeconds: 15,
  },
};

const mockFeatureFlagger = getFeatureFlagMock();

let apiClient: grout.Client<Api>;
let mockAuth: InsertedSmartCardAuthApi;
let mockUsbDrive: MockUsbDrive;
let server: Server;
let stateMachine: PaperHandlerStateMachine;

beforeAll(() => {
  expect(systemSettings.auth).not.toEqual(DEFAULT_SYSTEM_SETTINGS.auth);
});

beforeEach(async () => {
  mockFeatureFlagger.enableFeatureFlag(
    BooleanEnvironmentVariableName.SKIP_ELECTION_PACKAGE_AUTHENTICATION
  );

  const result = await createApp();
  apiClient = result.apiClient;
  mockAuth = result.mockAuth;
  mockUsbDrive = result.mockUsbDrive;
  server = result.server;
  stateMachine = result.stateMachine;
});

afterEach(async () => {
  await stateMachine.cleanUp();
  server?.close();
});

test('getAuthStatus', async () => {
  await configureApp(apiClient, mockAuth, mockUsbDrive, systemSettings);
  mockOf(mockAuth.getAuthStatus).mockClear(); // Clear mock calls from configureApp

  await apiClient.getAuthStatus();
  expect(mockAuth.getAuthStatus).toHaveBeenCalledTimes(1);
  expect(mockAuth.getAuthStatus).toHaveBeenNthCalledWith(1, {
    ...systemSettings.auth,
    electionKey,
    jurisdiction,
  });
});

test('checkPin', async () => {
  await configureApp(apiClient, mockAuth, mockUsbDrive, systemSettings);

  await apiClient.checkPin({ pin: '123456' });
  expect(mockAuth.checkPin).toHaveBeenCalledTimes(1);
  expect(mockAuth.checkPin).toHaveBeenNthCalledWith(
    1,
    { ...systemSettings.auth, electionKey, jurisdiction },
    { pin: '123456' }
  );
});

test('logOut', async () => {
  await configureApp(apiClient, mockAuth, mockUsbDrive, systemSettings);

  await apiClient.logOut();
  expect(mockAuth.logOut).toHaveBeenCalledTimes(1);
  expect(mockAuth.logOut).toHaveBeenNthCalledWith(1, {
    ...systemSettings.auth,
    electionKey,
    jurisdiction,
  });
});

test('updateSessionExpiry', async () => {
  await configureApp(apiClient, mockAuth, mockUsbDrive, systemSettings);

  await apiClient.updateSessionExpiry({
    sessionExpiresAt: DateTime.now().plus({ seconds: 60 }).toJSDate(),
  });
  expect(mockAuth.updateSessionExpiry).toHaveBeenCalledTimes(1);
  expect(mockAuth.updateSessionExpiry).toHaveBeenNthCalledWith(
    1,
    { ...systemSettings.auth, electionKey, jurisdiction },
    { sessionExpiresAt: expect.any(Date) }
  );
});

test('startCardlessVoterSession', async () => {
  await configureApp(apiClient, mockAuth, mockUsbDrive, systemSettings);

  await apiClient.startCardlessVoterSession({
    ballotStyleId: 'b1' as BallotStyleId,
    precinctId: 'p1',
  });
  expect(mockAuth.startCardlessVoterSession).toHaveBeenCalledTimes(1);
  expect(mockAuth.startCardlessVoterSession).toHaveBeenNthCalledWith(
    1,
    { ...systemSettings.auth, electionKey, jurisdiction },
    { ballotStyleId: 'b1' as BallotStyleId, precinctId: 'p1' }
  );
});

test('endCardlessVoterSession', async () => {
  jest.spyOn(stateMachine, 'reset');

  await configureApp(apiClient, mockAuth, mockUsbDrive, systemSettings);

  await apiClient.endCardlessVoterSession();
  expect(mockAuth.endCardlessVoterSession).toHaveBeenCalledTimes(1);
  expect(mockAuth.endCardlessVoterSession).toHaveBeenNthCalledWith(1, {
    ...systemSettings.auth,
    electionKey,
    jurisdiction,
  });
  expect(stateMachine.reset).toHaveBeenCalled();
});

test('getAuthStatus before election definition has been configured', async () => {
  await apiClient.getAuthStatus();

  // Additional call expected from the state machine:
  expect(mockAuth.getAuthStatus).toHaveBeenCalledTimes(2);
  expect(mockAuth.getAuthStatus).toHaveBeenNthCalledWith(
    1,
    DEFAULT_SYSTEM_SETTINGS.auth
  );
});

test('checkPin before election definition has been configured', async () => {
  await apiClient.checkPin({ pin: '123456' });
  expect(mockAuth.checkPin).toHaveBeenCalledTimes(1);
  expect(mockAuth.checkPin).toHaveBeenNthCalledWith(
    1,
    DEFAULT_SYSTEM_SETTINGS.auth,
    { pin: '123456' }
  );
});

test('logOut before election definition has been configured', async () => {
  await apiClient.logOut();
  expect(mockAuth.logOut).toHaveBeenCalledTimes(1);
  expect(mockAuth.logOut).toHaveBeenNthCalledWith(
    1,
    DEFAULT_SYSTEM_SETTINGS.auth
  );
});

test('updateSessionExpiry before election definition has been configured', async () => {
  await apiClient.updateSessionExpiry({
    sessionExpiresAt: DateTime.now().plus({ seconds: 60 }).toJSDate(),
  });
  expect(mockAuth.updateSessionExpiry).toHaveBeenCalledTimes(1);
  expect(mockAuth.updateSessionExpiry).toHaveBeenNthCalledWith(
    1,
    DEFAULT_SYSTEM_SETTINGS.auth,
    { sessionExpiresAt: expect.any(Date) }
  );
});

test('startCardlessVoterSession before election definition has been configured', async () => {
  await apiClient.startCardlessVoterSession({
    ballotStyleId: 'b1' as BallotStyleId,
    precinctId: 'p1',
  });
  expect(mockAuth.startCardlessVoterSession).toHaveBeenCalledTimes(1);
  expect(mockAuth.startCardlessVoterSession).toHaveBeenNthCalledWith(
    1,
    DEFAULT_SYSTEM_SETTINGS.auth,
    { ballotStyleId: 'b1' as BallotStyleId, precinctId: 'p1' }
  );
});

test('endCardlessVoterSession before election definition has been configured', async () => {
  await apiClient.endCardlessVoterSession();
  expect(mockAuth.endCardlessVoterSession).toHaveBeenCalledTimes(1);
  expect(mockAuth.endCardlessVoterSession).toHaveBeenNthCalledWith(
    1,
    DEFAULT_SYSTEM_SETTINGS.auth
  );
});

test('updateCardlessVoterBallotStyle', async () => {
  await apiClient.updateCardlessVoterBallotStyle({
    ballotStyleId: '2_es-US' as BallotStyleId,
  });

  expect(mockAuth.updateCardlessVoterBallotStyle).toHaveBeenCalledTimes(1);
  expect(mockAuth.updateCardlessVoterBallotStyle).toHaveBeenLastCalledWith({
    ballotStyleId: '2_es-US' as BallotStyleId,
  });
});
