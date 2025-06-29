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
  mockElectionManagerUser,
  mockOf,
  mockPollWorkerUser,
  mockSessionExpiresAt,
} from '@vx/libs/test-utils/src';
import { withApp } from '../../test/helpers/pdi_helpers';
import { configureApp, waitForStatus } from '../../test/helpers/shared_helpers';
import { delays } from './state_machine';

jest.setTimeout(20_000);

const mockFeatureFlagger = getFeatureFlagMock();

beforeEach(() => {
  mockFeatureFlagger.enableFeatureFlag(
    BooleanEnvironmentVariableName.SKIP_ELECTION_PACKAGE_AUTHENTICATION
  );
});

test('if election manager card inserted, scanning paused', async () => {
  await withApp(async ({ api, mockScanner, mockUsbDrive, mockAuth, clock }) => {
    await configureApp(api, mockAuth, mockUsbDrive);

    clock.increment(delays.DELAY_SCANNING_ENABLED_POLLING_INTERVAL);
    await waitForStatus(api, { state: 'no_paper' });
    expect(mockScanner.client.enableScanning).toHaveBeenCalled();

    // Insert election manager card
    mockOf(mockAuth.getAuthStatus).mockResolvedValue({
      status: 'logged_in',
      user: mockElectionManagerUser(),
      sessionExpiresAt: mockSessionExpiresAt(),
    });

    // Scanning should be paused
    clock.increment(delays.DELAY_SCANNING_ENABLED_POLLING_INTERVAL);
    await waitForStatus(api, { state: 'paused' });
    expect(mockScanner.client.disableScanning).toHaveBeenCalled();

    // Remove the card
    mockOf(mockAuth.getAuthStatus).mockResolvedValue({
      status: 'logged_out',
      reason: 'no_card',
    });

    // Scanning should be unpaused
    clock.increment(delays.DELAY_SCANNING_ENABLED_POLLING_INTERVAL);
    await waitForStatus(api, { state: 'no_paper' });
    expect(mockScanner.client.enableScanning).toHaveBeenCalled();
  });
});

test('if poll worker card inserted, scanning paused', async () => {
  await withApp(async ({ api, mockScanner, mockUsbDrive, mockAuth, clock }) => {
    await configureApp(api, mockAuth, mockUsbDrive, { testMode: true });

    clock.increment(delays.DELAY_SCANNING_ENABLED_POLLING_INTERVAL);
    await waitForStatus(api, { state: 'no_paper' });
    expect(mockScanner.client.enableScanning).toHaveBeenCalled();

    // Insert poll worker card
    mockOf(mockAuth.getAuthStatus).mockResolvedValue({
      status: 'logged_in',
      user: mockPollWorkerUser(),
      sessionExpiresAt: mockSessionExpiresAt(),
    });

    // Scanning should be paused
    clock.increment(delays.DELAY_SCANNING_ENABLED_POLLING_INTERVAL);
    await waitForStatus(api, { state: 'paused' });
    expect(mockScanner.client.disableScanning).toHaveBeenCalled();

    // Remove the card
    mockOf(mockAuth.getAuthStatus).mockResolvedValue({
      status: 'logged_out',
      reason: 'no_card',
    });

    // Scanning should be unpaused
    clock.increment(delays.DELAY_SCANNING_ENABLED_POLLING_INTERVAL);
    await waitForStatus(api, { state: 'no_paper' });
    expect(mockScanner.client.enableScanning).toHaveBeenCalled();
  });
});
