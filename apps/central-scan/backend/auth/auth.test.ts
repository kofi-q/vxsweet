import { DateTime } from 'luxon';
import { dirSync } from 'tmp';
import { buildMockDippedSmartCardAuth } from '@vx/libs/auth/test-utils';
import { type DippedSmartCardAuthApi } from '@vx/libs/auth/dipped-cards';
import { Logger, mockBaseLogger } from '@vx/libs/logging/src';
import {
  DEFAULT_SYSTEM_SETTINGS,
  type SystemSettings,
  constructElectionKey,
  TEST_JURISDICTION,
} from '@vx/libs/types/elections';

import * as electionGridLayoutNewHampshireTestBallotFixtures from '@vx/libs/fixtures/src/data/electionGridLayoutNewHampshireTestBallot';
import { createMockUsbDrive } from '@vx/libs/usb-drive/src';
import { makeMockScanner } from '../test/util/mocks';
import { type Api, buildApi } from '../app/app';
import { Importer } from '../importer/importer';
import { createWorkspace, type Workspace } from '../workspace/workspace';
import { buildMockLogger } from '../test/helpers/setup_app';

let api: Api;
let auth: DippedSmartCardAuthApi;
let workspace: Workspace;
let logger: Logger;

beforeEach(() => {
  auth = buildMockDippedSmartCardAuth();
  workspace = createWorkspace(dirSync().name, mockBaseLogger());
  logger = buildMockLogger(auth, workspace);
  const scanner = makeMockScanner();

  api = buildApi({
    auth,
    usbDrive: createMockUsbDrive().usbDrive,
    scanner,
    importer: new Importer({ workspace, scanner, logger }),
    workspace,
    logger,
  });
});

const jurisdiction = TEST_JURISDICTION;
const electionDefinition =
  electionGridLayoutNewHampshireTestBallotFixtures.electionJson.toElectionDefinition();
const { electionData, election } = electionDefinition;
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

beforeAll(() => {
  expect(systemSettings.auth).not.toEqual(DEFAULT_SYSTEM_SETTINGS.auth);
});

// eslint-disable-next-line @typescript-eslint/no-shadow
function configureMachine(systemSettings: SystemSettings): void {
  workspace.store.setElectionAndJurisdiction({
    electionData,
    jurisdiction,
    electionPackageHash: 'test-election-package-hash',
  });
  workspace.store.setSystemSettings(systemSettings);
}

test('getAuthStatus', async () => {
  configureMachine(systemSettings);

  await api.getAuthStatus();
  expect(auth.getAuthStatus).toHaveBeenCalledTimes(1);
  expect(auth.getAuthStatus).toHaveBeenNthCalledWith(1, {
    electionKey,
    jurisdiction,
    ...systemSettings.auth,
  });
});

test('checkPin', async () => {
  configureMachine(systemSettings);

  await api.checkPin({ pin: '123456' });
  expect(auth.checkPin).toHaveBeenCalledTimes(1);
  expect(auth.checkPin).toHaveBeenNthCalledWith(
    1,
    { electionKey, jurisdiction, ...systemSettings.auth },
    { pin: '123456' }
  );
});

test('logOut', async () => {
  configureMachine(systemSettings);

  await api.logOut();
  expect(auth.logOut).toHaveBeenCalledTimes(1);
  expect(auth.logOut).toHaveBeenNthCalledWith(1, {
    electionKey,
    jurisdiction,
    ...systemSettings.auth,
  });
});

test('updateSessionExpiry', async () => {
  configureMachine(systemSettings);

  await api.updateSessionExpiry({
    sessionExpiresAt: DateTime.now().plus({ seconds: 60 }).toJSDate(),
  });
  expect(auth.updateSessionExpiry).toHaveBeenCalledTimes(1);
  expect(auth.updateSessionExpiry).toHaveBeenNthCalledWith(
    1,
    {
      electionKey,
      jurisdiction,
      ...systemSettings.auth,
    },
    { sessionExpiresAt: expect.any(Date) }
  );
});

test('getAuthStatus before election definition has been configured', async () => {
  await api.getAuthStatus();
  expect(auth.getAuthStatus).toHaveBeenCalledTimes(1);
  expect(auth.getAuthStatus).toHaveBeenNthCalledWith(
    1,
    DEFAULT_SYSTEM_SETTINGS.auth
  );
});

test('checkPin before election definition has been configured', async () => {
  await api.checkPin({ pin: '123456' });
  expect(auth.checkPin).toHaveBeenCalledTimes(1);
  expect(auth.checkPin).toHaveBeenNthCalledWith(
    1,
    DEFAULT_SYSTEM_SETTINGS.auth,
    {
      pin: '123456',
    }
  );
});

test('logOut before election definition has been configured', async () => {
  await api.logOut();
  expect(auth.logOut).toHaveBeenCalledTimes(1);
  expect(auth.logOut).toHaveBeenNthCalledWith(1, DEFAULT_SYSTEM_SETTINGS.auth);
});

test('updateSessionExpiry before election definition has been configured', async () => {
  await api.updateSessionExpiry({
    sessionExpiresAt: DateTime.now().plus({ seconds: 60 }).toJSDate(),
  });
  expect(auth.updateSessionExpiry).toHaveBeenCalledTimes(1);
  expect(auth.updateSessionExpiry).toHaveBeenNthCalledWith(
    1,
    DEFAULT_SYSTEM_SETTINGS.auth,
    { sessionExpiresAt: expect.any(Date) }
  );
});
