import { DateTime } from 'luxon';
import * as electionFamousNames2021Fixtures from '@vx/libs/fixtures/src/data/electionFamousNames2021';
import {
  DEFAULT_SYSTEM_SETTINGS,
  type SystemSettings,
  constructElectionKey,
  TEST_JURISDICTION,
} from '@vx/libs/types/elections';

import { buildTestEnvironment, configureMachine } from '../test/app';

beforeEach(() => {
  process.env = { ...process.env, VX_MACHINE_JURISDICTION: TEST_JURISDICTION };
});

const jurisdiction = TEST_JURISDICTION;
const electionDefinition =
  electionFamousNames2021Fixtures.electionJson.toElectionDefinition();
const electionKey = constructElectionKey(electionDefinition.election);
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

beforeAll(() => {
  expect(systemSettings.auth).not.toEqual(DEFAULT_SYSTEM_SETTINGS.auth);
});

test('getAuthStatus', async () => {
  const { api, auth } = buildTestEnvironment();
  await configureMachine(api, auth, electionDefinition, systemSettings);
  auth.getAuthStatus.mockClear(); // Clear mock calls from configureMachine

  await api.getAuthStatus();
  expect(auth.getAuthStatus).toHaveBeenCalledTimes(1);
  expect(auth.getAuthStatus).toHaveBeenNthCalledWith(1, {
    electionKey,
    jurisdiction,
    ...systemSettings.auth,
  });
});

test('checkPin', async () => {
  const { api, auth } = buildTestEnvironment();
  await configureMachine(api, auth, electionDefinition, systemSettings);

  await api.checkPin({ pin: '123456' });
  expect(auth.checkPin).toHaveBeenCalledTimes(1);
  expect(auth.checkPin).toHaveBeenNthCalledWith(
    1,
    { electionKey, jurisdiction, ...systemSettings.auth },
    { pin: '123456' }
  );
});

test('logOut', async () => {
  const { api, auth } = buildTestEnvironment();
  await configureMachine(api, auth, electionDefinition, systemSettings);

  api.logOut();
  expect(auth.logOut).toHaveBeenCalledTimes(1);
  expect(auth.logOut).toHaveBeenNthCalledWith(1, {
    electionKey,
    jurisdiction,
    ...systemSettings.auth,
  });
});

test('updateSessionExpiry', async () => {
  const { api, auth } = buildTestEnvironment();
  await configureMachine(api, auth, electionDefinition, systemSettings);

  await api.updateSessionExpiry({
    sessionExpiresAt: DateTime.now().plus({ seconds: 60 }).toJSDate(),
  });
  expect(auth.updateSessionExpiry).toHaveBeenCalledTimes(1);
  expect(auth.updateSessionExpiry).toHaveBeenNthCalledWith(
    1,
    { electionKey, jurisdiction, ...systemSettings.auth },
    { sessionExpiresAt: expect.any(Date) }
  );
});

test('programCard', async () => {
  const { api, auth } = buildTestEnvironment();
  await configureMachine(api, auth, electionDefinition, systemSettings);

  void (await api.programCard({ userRole: 'system_administrator' }));
  expect(auth.programCard).toHaveBeenCalledTimes(1);
  expect(auth.programCard).toHaveBeenNthCalledWith(
    1,
    { electionKey, jurisdiction, ...systemSettings.auth },
    { userRole: 'system_administrator' }
  );

  void (await api.programCard({ userRole: 'election_manager' }));
  expect(auth.programCard).toHaveBeenCalledTimes(2);
  expect(auth.programCard).toHaveBeenNthCalledWith(
    2,
    { electionKey, jurisdiction, ...systemSettings.auth },
    { userRole: 'election_manager' }
  );

  void (await api.programCard({ userRole: 'poll_worker' }));
  expect(auth.programCard).toHaveBeenCalledTimes(3);
  expect(auth.programCard).toHaveBeenNthCalledWith(
    3,
    { electionKey, jurisdiction, ...systemSettings.auth },
    { userRole: 'poll_worker' }
  );
});

test('unprogramCard', async () => {
  const { api, auth } = buildTestEnvironment();
  await configureMachine(api, auth, electionDefinition, systemSettings);

  void (await api.unprogramCard());
  expect(auth.unprogramCard).toHaveBeenCalledTimes(1);
  expect(auth.unprogramCard).toHaveBeenNthCalledWith(1, {
    electionKey,
    jurisdiction,
    ...systemSettings.auth,
  });
});

test('getAuthStatus before election definition has been configured', async () => {
  const { api, auth } = buildTestEnvironment();

  await api.getAuthStatus();
  expect(auth.getAuthStatus).toHaveBeenCalledTimes(1);
  expect(auth.getAuthStatus).toHaveBeenNthCalledWith(1, {
    jurisdiction,
    ...DEFAULT_SYSTEM_SETTINGS.auth,
  });
});

test('checkPin before election definition has been configured', async () => {
  const { api, auth } = buildTestEnvironment();

  await api.checkPin({ pin: '123456' });
  expect(auth.checkPin).toHaveBeenCalledTimes(1);
  expect(auth.checkPin).toHaveBeenNthCalledWith(
    1,
    {
      jurisdiction,
      ...DEFAULT_SYSTEM_SETTINGS.auth,
    },
    { pin: '123456' }
  );
});

test('logOut before election definition has been configured', () => {
  const { api, auth } = buildTestEnvironment();

  api.logOut();
  expect(auth.logOut).toHaveBeenCalledTimes(1);
  expect(auth.logOut).toHaveBeenNthCalledWith(1, {
    jurisdiction,
    ...DEFAULT_SYSTEM_SETTINGS.auth,
  });
});

test('updateSessionExpiry before election definition has been configured', async () => {
  const { api, auth } = buildTestEnvironment();

  await api.updateSessionExpiry({
    sessionExpiresAt: DateTime.now().plus({ seconds: 60 }).toJSDate(),
  });
  expect(auth.updateSessionExpiry).toHaveBeenCalledTimes(1);
  expect(auth.updateSessionExpiry).toHaveBeenNthCalledWith(
    1,
    {
      jurisdiction,
      ...DEFAULT_SYSTEM_SETTINGS.auth,
    },
    { sessionExpiresAt: expect.any(Date) }
  );
});
