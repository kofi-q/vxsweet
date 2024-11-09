jest.mock('@vx/libs/utils/src', (): typeof import('@vx/libs/utils/src') => {
  return {
    ...jest.requireActual('@vx/libs/utils/src'),
    isFeatureFlagEnabled: (flag) => mockFeatureFlagger.isEnabled(flag),
  };
});

import {
  getFeatureFlagMock,
  BooleanEnvironmentVariableName,
} from '@vx/libs/utils/src';
import {
  mockOf,
  mockElectionManagerUser,
  mockSessionExpiresAt,
} from '@vx/libs/test-utils/src';
import { type Result } from '@vx/libs/basics/result';
import { deferred } from '@vx/libs/basics/async';
import { type ScannerError } from '@vx/libs/pdi-scanner/src/ts';
import { configureApp, waitForStatus } from '../../test/helpers/shared_helpers';
import { withApp } from '../../test/helpers/pdi_helpers';
import { delays } from './state_machine';

jest.setTimeout(20_000);

const mockFeatureFlagger = getFeatureFlagMock();

beforeEach(() => {
  mockFeatureFlagger.enableFeatureFlag(
    BooleanEnvironmentVariableName.SKIP_ELECTION_PACKAGE_AUTHENTICATION
  );
});

test('calibrate double feed detection', async () => {
  await withApp(async ({ api, mockScanner, mockUsbDrive, mockAuth, clock }) => {
    await configureApp(api, mockAuth, mockUsbDrive);

    // Insert election manager card
    mockOf(mockAuth.getAuthStatus).mockResolvedValue({
      status: 'logged_in',
      user: mockElectionManagerUser(),
      sessionExpiresAt: mockSessionExpiresAt(),
    });

    // Scanning should be paused
    clock.increment(delays.DELAY_SCANNING_ENABLED_POLLING_INTERVAL);
    await waitForStatus(api, { state: 'paused' });

    // Initiate double feed calibration
    api.beginDoubleFeedCalibration();
    await waitForStatus(api, {
      state: 'calibrating_double_feed_detection.double_sheet',
    });
    expect(
      mockScanner.client.calibrateDoubleFeedDetection
    ).toHaveBeenLastCalledWith('double');

    // Simulate insert of double sheet
    mockScanner.emitEvent({ event: 'doubleFeedCalibrationComplete' });
    await waitForStatus(api, {
      state: 'calibrating_double_feed_detection.single_sheet',
    });
    expect(
      mockScanner.client.calibrateDoubleFeedDetection
    ).toHaveBeenLastCalledWith('single');

    // Simulate insert of single sheet
    mockScanner.emitEvent({ event: 'doubleFeedCalibrationComplete' });
    await waitForStatus(api, {
      state: 'calibrating_double_feed_detection.done',
    });

    // End double feed calibration
    api.endDoubleFeedCalibration();
    await waitForStatus(api, { state: 'paused' });
  });
});

test('calibration time out waiting for double sheet', async () => {
  await withApp(async ({ api, mockScanner, mockUsbDrive, mockAuth, clock }) => {
    await configureApp(api, mockAuth, mockUsbDrive);

    // Insert election manager card
    mockOf(mockAuth.getAuthStatus).mockResolvedValue({
      status: 'logged_in',
      user: mockElectionManagerUser(),
      sessionExpiresAt: mockSessionExpiresAt(),
    });

    // Scanning should be paused
    clock.increment(delays.DELAY_SCANNING_ENABLED_POLLING_INTERVAL);
    await waitForStatus(api, { state: 'paused' });

    // Initiate double feed calibration
    api.beginDoubleFeedCalibration();
    await waitForStatus(api, {
      state: 'calibrating_double_feed_detection.double_sheet',
    });

    // Simulate PDI scanner timeout
    mockScanner.emitEvent({ event: 'doubleFeedCalibrationTimedOut' });
    await waitForStatus(api, {
      state: 'calibrating_double_feed_detection.done',
      error: 'double_feed_calibration_timed_out',
    });

    // End double feed calibration
    api.endDoubleFeedCalibration();
    await waitForStatus(api, { state: 'paused' });
  });
});

test('calibration time out waiting for single sheet', async () => {
  await withApp(async ({ api, mockScanner, mockUsbDrive, mockAuth, clock }) => {
    await configureApp(api, mockAuth, mockUsbDrive);

    // Insert election manager card
    mockOf(mockAuth.getAuthStatus).mockResolvedValue({
      status: 'logged_in',
      user: mockElectionManagerUser(),
      sessionExpiresAt: mockSessionExpiresAt(),
    });

    // Scanning should be paused
    clock.increment(delays.DELAY_SCANNING_ENABLED_POLLING_INTERVAL);
    await waitForStatus(api, { state: 'paused' });

    // Initiate double feed calibration
    api.beginDoubleFeedCalibration();
    await waitForStatus(api, {
      state: 'calibrating_double_feed_detection.double_sheet',
    });

    // Simulate insert of double sheet
    mockScanner.emitEvent({ event: 'doubleFeedCalibrationComplete' });
    await waitForStatus(api, {
      state: 'calibrating_double_feed_detection.single_sheet',
    });

    // Simulate PDI scanner timeout
    mockScanner.emitEvent({ event: 'doubleFeedCalibrationTimedOut' });
    await waitForStatus(api, {
      state: 'calibrating_double_feed_detection.done',
      error: 'double_feed_calibration_timed_out',
    });

    // End double feed calibration
    api.endDoubleFeedCalibration();
    await waitForStatus(api, { state: 'paused' });
  });
});

test('error with calibration command for double sheet', async () => {
  await withApp(async ({ api, mockScanner, mockUsbDrive, mockAuth, clock }) => {
    await configureApp(api, mockAuth, mockUsbDrive);

    mockOf(mockAuth.getAuthStatus).mockResolvedValue({
      status: 'logged_in',
      user: mockElectionManagerUser(),
      sessionExpiresAt: mockSessionExpiresAt(),
    });
    clock.increment(delays.DELAY_SCANNING_ENABLED_POLLING_INTERVAL);
    await waitForStatus(api, { state: 'paused' });

    // We haven't seen this happen in practice, but we cover it just in case
    mockScanner.client.calibrateDoubleFeedDetection.mockRejectedValue(
      new Error('some error')
    );
    const deferredConnect = deferred<Result<void, ScannerError>>();
    mockScanner.client.connect.mockResolvedValue(deferredConnect.promise);

    api.beginDoubleFeedCalibration();
    await waitForStatus(api, {
      state: 'unrecoverable_error',
    });
  });
});

test('error with calibration command for single sheet', async () => {
  await withApp(async ({ api, mockScanner, mockUsbDrive, mockAuth, clock }) => {
    await configureApp(api, mockAuth, mockUsbDrive);

    mockOf(mockAuth.getAuthStatus).mockResolvedValue({
      status: 'logged_in',
      user: mockElectionManagerUser(),
      sessionExpiresAt: mockSessionExpiresAt(),
    });
    clock.increment(delays.DELAY_SCANNING_ENABLED_POLLING_INTERVAL);
    await waitForStatus(api, { state: 'paused' });

    // Initiate double feed calibration
    api.beginDoubleFeedCalibration();
    await waitForStatus(api, {
      state: 'calibrating_double_feed_detection.double_sheet',
    });

    mockScanner.client.calibrateDoubleFeedDetection.mockRejectedValue(
      new Error('some error')
    );
    const deferredConnect = deferred<Result<void, ScannerError>>();
    mockScanner.client.connect.mockResolvedValue(deferredConnect.promise);

    // Simulate insert of double sheet
    mockScanner.emitEvent({ event: 'doubleFeedCalibrationComplete' });
    await waitForStatus(api, {
      state: 'unrecoverable_error',
    });
  });
});
