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
  constructElectionKey,
  TEST_JURISDICTION,
} from '@vx/libs/types/elections';
import {
  BooleanEnvironmentVariableName,
  getFeatureFlagMock,
} from '@vx/libs/utils/src';

import { mockOf } from '@vx/libs/test-utils/src';
import { withApp } from '../test/helpers/pdi_helpers';
import { configureApp } from '../test/helpers/shared_helpers';

const jurisdiction = TEST_JURISDICTION;
const electionKey = constructElectionKey(
  electionFamousNames2021Fixtures.election
);
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
const electionPackage =
  electionFamousNames2021Fixtures.electionJson.toElectionPackage(
    systemSettings
  );

beforeAll(() => {
  expect(systemSettings.auth).not.toEqual(DEFAULT_SYSTEM_SETTINGS.auth);
});

const mockFeatureFlagger = getFeatureFlagMock();

beforeEach(() => {
  mockFeatureFlagger.enableFeatureFlag(
    BooleanEnvironmentVariableName.SKIP_ELECTION_PACKAGE_AUTHENTICATION
  );
});

test('getAuthStatus', async () => {
  await withApp(async ({ api, mockAuth, mockUsbDrive }) => {
    await configureApp(api, mockAuth, mockUsbDrive, { electionPackage });
    mockOf(mockAuth.getAuthStatus).mockClear(); // Clear mock calls from configureApp

    await api.getAuthStatus();
    expect(mockAuth.getAuthStatus).toHaveBeenCalledTimes(1);
    expect(mockAuth.getAuthStatus).toHaveBeenNthCalledWith(1, {
      ...systemSettings.auth,
      electionKey,
      jurisdiction,
    });
  });
});

test('checkPin', async () => {
  await withApp(async ({ api, mockAuth, mockUsbDrive }) => {
    await configureApp(api, mockAuth, mockUsbDrive, { electionPackage });

    await api.checkPin({ pin: '123456' });
    expect(mockAuth.checkPin).toHaveBeenCalledTimes(1);
    expect(mockAuth.checkPin).toHaveBeenNthCalledWith(
      1,
      { ...systemSettings.auth, electionKey, jurisdiction },
      { pin: '123456' }
    );
  });
});

test('logOut', async () => {
  await withApp(async ({ api, mockAuth, mockUsbDrive }) => {
    await configureApp(api, mockAuth, mockUsbDrive, { electionPackage });

    api.logOut();
    expect(mockAuth.logOut).toHaveBeenCalledTimes(1);
    expect(mockAuth.logOut).toHaveBeenNthCalledWith(1, {
      ...systemSettings.auth,
      electionKey,
      jurisdiction,
    });
  });
});

test('updateSessionExpiry', async () => {
  await withApp(async ({ api, mockAuth, mockUsbDrive }) => {
    await configureApp(api, mockAuth, mockUsbDrive, { electionPackage });

    await api.updateSessionExpiry({
      sessionExpiresAt: DateTime.now().plus({ seconds: 60 }).toJSDate(),
    });
    expect(mockAuth.updateSessionExpiry).toHaveBeenCalledTimes(1);
    expect(mockAuth.updateSessionExpiry).toHaveBeenNthCalledWith(
      1,
      { ...systemSettings.auth, electionKey, jurisdiction },
      { sessionExpiresAt: expect.any(Date) }
    );
  });
});

test('getAuthStatus before election definition has been configured', async () => {
  await withApp(async ({ api, mockAuth }) => {
    mockOf(mockAuth.getAuthStatus).mockClear(); // Clear mock calls from state machine
    await api.getAuthStatus();
    expect(mockAuth.getAuthStatus).toHaveBeenCalledTimes(1);
    expect(mockAuth.getAuthStatus).toHaveBeenNthCalledWith(
      1,
      DEFAULT_SYSTEM_SETTINGS.auth
    );
  });
});

test('checkPin before election definition has been configured', async () => {
  await withApp(async ({ api, mockAuth }) => {
    await api.checkPin({ pin: '123456' });
    expect(mockAuth.checkPin).toHaveBeenCalledTimes(1);
    expect(mockAuth.checkPin).toHaveBeenNthCalledWith(
      1,
      DEFAULT_SYSTEM_SETTINGS.auth,
      { pin: '123456' }
    );
  });
});

test('logOut before election definition has been configured', async () => {
  await withApp(({ api, mockAuth }) => {
    api.logOut();
    expect(mockAuth.logOut).toHaveBeenCalledTimes(1);
    expect(mockAuth.logOut).toHaveBeenNthCalledWith(
      1,
      DEFAULT_SYSTEM_SETTINGS.auth
    );
  });
});

test('updateSessionExpiry before election definition has been configured', async () => {
  await withApp(async ({ api, mockAuth }) => {
    await api.updateSessionExpiry({
      sessionExpiresAt: DateTime.now().plus({ seconds: 60 }).toJSDate(),
    });
    expect(mockAuth.updateSessionExpiry).toHaveBeenCalledTimes(1);
    expect(mockAuth.updateSessionExpiry).toHaveBeenNthCalledWith(
      1,
      DEFAULT_SYSTEM_SETTINGS.auth,
      { sessionExpiresAt: expect.any(Date) }
    );
  });
});
