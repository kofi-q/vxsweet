jest.mock('@vx/libs/utils/src', (): typeof import('@vx/libs/utils/src') => {
  return {
    ...jest.requireActual('@vx/libs/utils/src'),
    isFeatureFlagEnabled: (flag) => mockFeatureFlagger.isEnabled(flag),
  };
});

import {
  BooleanEnvironmentVariableName,
  getFeatureFlagMock,
} from '@vx/libs/utils/src';

import { scanBallot, withApp } from '../test/helpers/pdi_helpers';
import { configureApp } from '../test/helpers/shared_helpers';

const mockFeatureFlagger = getFeatureFlagMock();

beforeEach(() => {
  mockFeatureFlagger.resetFeatureFlags();
  mockFeatureFlagger.enableFeatureFlag(
    BooleanEnvironmentVariableName.SKIP_ELECTION_PACKAGE_AUTHENTICATION
  );
});

test('getUsbDriveStatus', async () => {
  await withApp(async ({ api, mockUsbDrive }) => {
    mockUsbDrive.removeUsbDrive();
    await expect(api.getUsbDriveStatus()).resolves.toEqual({
      status: 'no_drive',
    });
    mockUsbDrive.insertUsbDrive({});
    await expect(api.getUsbDriveStatus()).resolves.toEqual({
      status: 'mounted',
      mountPoint: expect.any(String),
    });
  });
});

test('ejectUsbDrive', async () => {
  await withApp(async ({ api, mockUsbDrive }) => {
    mockUsbDrive.usbDrive.eject.expectCallWith().resolves();
    await expect(api.ejectUsbDrive()).resolves.toBeUndefined();
  });
});

test('doesUsbDriveRequireCastVoteRecordSync is properly populated', async () => {
  await withApp(
    async ({ api, mockAuth, mockUsbDrive, mockScanner, workspace, clock }) => {
      await configureApp(api, mockAuth, mockUsbDrive, { testMode: true });
      const mountedUsbDriveStatus = {
        status: 'mounted',
        mountPoint: expect.any(String),
      } as const;

      await expect(api.getUsbDriveStatus()).resolves.toEqual(
        mountedUsbDriveStatus
      );

      await scanBallot(mockScanner, clock, api, workspace.store, 0);
      await expect(api.getUsbDriveStatus()).resolves.toEqual(
        mountedUsbDriveStatus
      );

      mockUsbDrive.removeUsbDrive();
      await expect(api.getUsbDriveStatus()).resolves.toEqual({
        status: 'no_drive',
      });

      // Insert an empty USB drive and ensure that we detect that it requires a cast vote record
      // sync
      mockUsbDrive.insertUsbDrive({});
      await expect(api.getUsbDriveStatus()).resolves.toEqual({
        ...mountedUsbDriveStatus,
        doesUsbDriveRequireCastVoteRecordSync: true,
      });
    }
  );
}, 30_000);
