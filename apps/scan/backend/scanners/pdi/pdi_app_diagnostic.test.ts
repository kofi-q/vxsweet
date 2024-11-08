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
import {
  mockOf,
  mockSessionExpiresAt,
  mockSystemAdministratorUser,
} from '@vx/libs/test-utils/src';
import {
  ballotPaperDimensions,
  HmpbBallotPaperSize,
} from '@vx/libs/types/elections';
import { iter } from '@vx/libs/basics/iterators';
import { electionFamousNames2021Fixtures } from '@vx/libs/fixtures/src';
import { LogEventId } from '@vx/libs/logging/src';
import { ballotImages, withApp } from '../../test/helpers/pdi_helpers';
import {
  configureApp,
  expectStatus,
  waitForStatus,
} from '../../test/helpers/shared_helpers';
import { delays } from './state_machine';

jest.setTimeout(20_000);

const mockFeatureFlagger = getFeatureFlagMock();

beforeEach(() => {
  mockFeatureFlagger.enableFeatureFlag(
    BooleanEnvironmentVariableName.SKIP_ELECTION_PACKAGE_AUTHENTICATION
  );
});

test('scanner diagnostic, unconfigured - pass', async () => {
  await withApp(async ({ api, mockScanner, mockAuth, logger }) => {
    expect(api.getMostRecentScannerDiagnostic()).toBeNull();

    // Log in as system administrator
    mockOf(mockAuth.getAuthStatus).mockResolvedValue({
      status: 'logged_in',
      user: mockSystemAdministratorUser(),
      sessionExpiresAt: mockSessionExpiresAt(),
    });
    expectStatus(api, { state: 'paused' });
    expect(mockScanner.client.enableScanning).not.toHaveBeenCalled();

    // Start scanner diagnostic
    api.beginScannerDiagnostic();
    await waitForStatus(api, { state: 'scanner_diagnostic.running' });
    expect(mockScanner.client.enableScanning).toHaveBeenCalledTimes(1);
    expect(mockScanner.client.enableScanning).toHaveBeenCalledWith({
      doubleFeedDetectionEnabled: false,
      paperLengthInches: iter(Object.values(HmpbBallotPaperSize))
        .map((paperSize) => ballotPaperDimensions(paperSize).height)
        .max(),
    });

    // Simulate insert of blank sheet
    mockScanner.emitEvent({ event: 'scanStart' });
    expectStatus(api, { state: 'scanner_diagnostic.running' });
    mockScanner.emitEvent({
      event: 'scanComplete',
      images: await ballotImages.blankSheet(),
    });
    await waitForStatus(api, { state: 'scanner_diagnostic.done' });
    expect(mockScanner.client.ejectDocument).toHaveBeenCalledTimes(1);
    expect(mockScanner.client.ejectDocument).toHaveBeenCalledWith('toFront');

    // End scanner diagnostic
    api.endScannerDiagnostic();
    await waitForStatus(api, { state: 'paused' });
    expect(api.getMostRecentScannerDiagnostic()).toEqual({
      type: 'blank-sheet-scan',
      outcome: 'pass',
      timestamp: expect.any(Number),
    });

    expect(logger.log).toHaveBeenCalledWith(
      LogEventId.DiagnosticInit,
      'system_administrator',
      {
        disposition: 'success',
        message: 'User initiated a scanner diagnostic.',
      }
    );
    expect(logger.log).toHaveBeenCalledWith(
      LogEventId.DiagnosticComplete,
      'system_administrator',
      {
        disposition: 'success',
        message: 'Scanner diagnostic completed.',
      }
    );
  });
});

test('scanner diagnostic, configured - fail', async () => {
  const electionPackage =
    electionFamousNames2021Fixtures.electionJson.toElectionPackage();
  const { election } = electionPackage.electionDefinition;
  await withApp(
    async ({ api, mockScanner, mockAuth, mockUsbDrive, logger }) => {
      await configureApp(api, mockAuth, mockUsbDrive, {
        electionPackage,
      });
      expect(api.getMostRecentScannerDiagnostic()).toBeNull();

      // Log in as system administrator
      mockOf(mockAuth.getAuthStatus).mockResolvedValue({
        status: 'logged_in',
        user: mockSystemAdministratorUser(),
        sessionExpiresAt: mockSessionExpiresAt(),
      });
      expectStatus(api, { state: 'paused' });
      expect(mockScanner.client.enableScanning).not.toHaveBeenCalled();

      // Start scanner diagnostic
      api.beginScannerDiagnostic();
      await waitForStatus(api, { state: 'scanner_diagnostic.running' });
      expect(mockScanner.client.enableScanning).toHaveBeenCalledTimes(1);
      expect(mockScanner.client.enableScanning).toHaveBeenCalledWith({
        doubleFeedDetectionEnabled: false,
        paperLengthInches: ballotPaperDimensions(
          election.ballotLayout.paperSize
        ).height,
      });

      // Simulate insert of non-blank sheet
      mockScanner.emitEvent({ event: 'scanStart' });
      expectStatus(api, { state: 'scanner_diagnostic.running' });
      mockScanner.emitEvent({
        event: 'scanComplete',
        images: await ballotImages.completeHmpb(),
      });
      await waitForStatus(api, {
        state: 'scanner_diagnostic.done',
        error: 'scanner_diagnostic_failed',
      });
      expect(mockScanner.client.ejectDocument).toHaveBeenCalledTimes(1);
      expect(mockScanner.client.ejectDocument).toHaveBeenCalledWith('toFront');

      // End scanner diagnostic
      api.endScannerDiagnostic();
      await waitForStatus(api, { state: 'paused' });
      expect(api.getMostRecentScannerDiagnostic()).toEqual({
        type: 'blank-sheet-scan',
        outcome: 'fail',
        timestamp: expect.any(Number),
      });

      expect(logger.log).toHaveBeenCalledWith(
        LogEventId.DiagnosticInit,
        'system_administrator',
        {
          disposition: 'success',
          message: 'User initiated a scanner diagnostic.',
        }
      );
      expect(logger.log).toHaveBeenCalledWith(
        LogEventId.DiagnosticComplete,
        'system_administrator',
        {
          disposition: 'failure',
          message: 'Scanner diagnostic completed.',
        }
      );
    }
  );
});

test('removing card cancels diagnostic', async () => {
  await withApp(async ({ api, mockAuth, mockUsbDrive, clock }) => {
    await configureApp(api, mockAuth, mockUsbDrive);
    expect(api.getMostRecentScannerDiagnostic()).toBeNull();

    // Log in as system administrator
    mockOf(mockAuth.getAuthStatus).mockResolvedValue({
      status: 'logged_in',
      user: mockSystemAdministratorUser(),
      sessionExpiresAt: mockSessionExpiresAt(),
    });
    await waitForStatus(api, { state: 'paused' });

    // Start scanner diagnostic
    api.beginScannerDiagnostic();
    await waitForStatus(api, { state: 'scanner_diagnostic.running' });

    // Simulate card removal
    mockOf(mockAuth.getAuthStatus).mockResolvedValue({
      status: 'logged_out',
      reason: 'no_card',
    });
    clock.increment(delays.DELAY_AUTH_STATUS_POLLING_INTERVAL);
    await waitForStatus(api, { state: 'no_paper' });

    expect(api.getMostRecentScannerDiagnostic()).toBeNull();
  });
});

test('scanner error fails diagnostic', async () => {
  await withApp(async ({ api, mockScanner, mockAuth }) => {
    expect(api.getMostRecentScannerDiagnostic()).toBeNull();

    // Log in as system administrator
    mockOf(mockAuth.getAuthStatus).mockResolvedValue({
      status: 'logged_in',
      user: mockSystemAdministratorUser(),
      sessionExpiresAt: mockSessionExpiresAt(),
    });

    // Start scanner diagnostic
    api.beginScannerDiagnostic();
    await waitForStatus(api, { state: 'scanner_diagnostic.running' });

    // Simulate scanner error
    mockScanner.emitEvent({ event: 'error', code: 'scanFailed' });
    await waitForStatus(api, {
      state: 'scanner_diagnostic.done',
      error: 'client_error',
    });

    expect(api.getMostRecentScannerDiagnostic()).toEqual({
      type: 'blank-sheet-scan',
      outcome: 'fail',
      timestamp: expect.any(Number),
    });
  });
});

test('scanner unexpected event fails diagnostic', async () => {
  await withApp(async ({ api, mockScanner, mockAuth }) => {
    expect(api.getMostRecentScannerDiagnostic()).toBeNull();

    // Log in as system administrator
    mockOf(mockAuth.getAuthStatus).mockResolvedValue({
      status: 'logged_in',
      user: mockSystemAdministratorUser(),
      sessionExpiresAt: mockSessionExpiresAt(),
    });

    // Start scanner diagnostic
    api.beginScannerDiagnostic();
    await waitForStatus(api, { state: 'scanner_diagnostic.running' });

    // Simulate unexpected event
    mockScanner.emitEvent({ event: 'ejectPaused' });
    await waitForStatus(api, {
      state: 'scanner_diagnostic.done',
      error: 'unexpected_event',
    });

    expect(api.getMostRecentScannerDiagnostic()).toEqual({
      type: 'blank-sheet-scan',
      outcome: 'fail',
      timestamp: expect.any(Number),
    });
  });
});
