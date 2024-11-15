jest.mock('@vx/libs/utils/src', (): typeof import('@vx/libs/utils/src') => {
  return {
    ...jest.requireActual('@vx/libs/utils/src'),
    isFeatureFlagEnabled: (flag) => mockFeatureFlagger.isEnabled(flag),
  };
});

import {
  AdjudicationReason,
  DEFAULT_SYSTEM_SETTINGS,
} from '@vx/libs/types/elections';
import { type SheetInterpretation } from '@vx/libs/types/scanning';
import { ErrorCode, mocks } from '@vx/libs/custom-scanner/src';
import { err, ok } from '@vx/libs/basics/result';
import {
  BooleanEnvironmentVariableName,
  getFeatureFlagMock,
} from '@vx/libs/utils/src';
import * as electionGridLayoutNewHampshireTestBallotFixtures from '@vx/libs/fixtures/src/data/electionGridLayoutNewHampshireTestBallot';
import { configureApp, waitForStatus } from '../../test/helpers/shared_helpers';
import {
  ballotImages,
  simulateScan,
  withApp,
} from '../../test/helpers/custom_helpers';
import { delays } from './state_machine';

jest.setTimeout(20_000);

const mockFeatureFlagger = getFeatureFlagMock();

const needsReviewInterpretation: SheetInterpretation = {
  type: 'NeedsReviewSheet',
  reasons: [{ type: AdjudicationReason.BlankBallot }],
};

beforeEach(() => {
  mockFeatureFlagger.enableFeatureFlag(
    BooleanEnvironmentVariableName.SKIP_ELECTION_PACKAGE_AUTHENTICATION
  );
  mockFeatureFlagger.enableFeatureFlag(
    BooleanEnvironmentVariableName.USE_CUSTOM_SCANNER
  );
});

test('scanner powered off while waiting for paper', async () => {
  await withApp(async ({ api, mockScanner, mockUsbDrive, mockAuth, clock }) => {
    await configureApp(api, mockAuth, mockUsbDrive);

    mockScanner.getStatus.mockResolvedValue(err(ErrorCode.ScannerOffline));
    clock.increment(delays.DELAY_PAPER_STATUS_POLLING_INTERVAL);
    await waitForStatus(api, { state: 'disconnected' });

    mockScanner.getStatus.mockResolvedValue(ok(mocks.MOCK_NO_PAPER));
    clock.increment(delays.DELAY_RECONNECT);
    await waitForStatus(api, { state: 'no_paper' });
  });
});

test('scanner powered off while scanning', async () => {
  await withApp(async ({ api, mockScanner, mockUsbDrive, mockAuth, clock }) => {
    await configureApp(api, mockAuth, mockUsbDrive, { testMode: true });

    simulateScan(mockScanner, await ballotImages.completeBmd(), clock);
    mockScanner.getStatus.mockResolvedValue(err(ErrorCode.ScannerOffline));
    await waitForStatus(api, { state: 'disconnected' });

    mockScanner.getStatus.mockResolvedValue(ok(mocks.MOCK_INTERNAL_JAM));
    clock.increment(delays.DELAY_RECONNECT);
    await waitForStatus(api, { state: 'jammed' });
  });
});

test('scanner powered off while accepting', async () => {
  const interpretation: SheetInterpretation = {
    type: 'ValidSheet',
  };
  await withApp(async ({ api, mockScanner, mockUsbDrive, mockAuth, clock }) => {
    await configureApp(api, mockAuth, mockUsbDrive, { testMode: true });

    simulateScan(mockScanner, await ballotImages.completeBmd(), clock);
    await waitForStatus(api, {
      state: 'accepting',
      interpretation,
    });
    mockScanner.getStatus.mockResolvedValue(err(ErrorCode.ScannerOffline));
    clock.increment(delays.DELAY_PAPER_STATUS_POLLING_INTERVAL);
    await waitForStatus(api, { state: 'disconnected' });

    mockScanner.getStatus.mockResolvedValue(ok(mocks.MOCK_READY_TO_EJECT));
    clock.increment(delays.DELAY_RECONNECT);
    await waitForStatus(api, {
      state: 'rejecting',
      error: 'paper_in_back_after_reconnect',
    });
    mockScanner.getStatus.mockResolvedValue(ok(mocks.MOCK_READY_TO_SCAN));
    clock.increment(delays.DELAY_PAPER_STATUS_POLLING_INTERVAL);
    await waitForStatus(api, {
      state: 'rejected',
      error: 'paper_in_back_after_reconnect',
    });
  });
});

test('scanner powered off after accepting', async () => {
  const interpretation: SheetInterpretation = {
    type: 'ValidSheet',
  };
  await withApp(async ({ api, mockScanner, mockUsbDrive, mockAuth, clock }) => {
    await configureApp(api, mockAuth, mockUsbDrive, { testMode: true });

    simulateScan(mockScanner, await ballotImages.completeBmd(), clock);
    await waitForStatus(api, {
      state: 'accepting',
      interpretation,
    });
    mockScanner.getStatus.mockResolvedValue(ok(mocks.MOCK_NO_PAPER));
    clock.increment(delays.DELAY_PAPER_STATUS_POLLING_INTERVAL_DURING_ACCEPT);
    await waitForStatus(api, {
      state: 'accepted',
      interpretation,
      ballotsCounted: 1,
    });

    mockScanner.getStatus.mockResolvedValue(err(ErrorCode.ScannerOffline));
    clock.increment(delays.DELAY_PAPER_STATUS_POLLING_INTERVAL);
    await waitForStatus(api, {
      state: 'disconnected',
      ballotsCounted: 1,
    });

    mockScanner.getStatus.mockResolvedValue(ok(mocks.MOCK_NO_PAPER));
    clock.increment(delays.DELAY_RECONNECT);
    await waitForStatus(api, {
      state: 'no_paper',
      ballotsCounted: 1,
    });
  });
});

test('scanner powered off while rejecting', async () => {
  const interpretation: SheetInterpretation = {
    type: 'InvalidSheet',
    reason: 'invalid_ballot_hash',
  };
  await withApp(async ({ api, mockScanner, mockUsbDrive, mockAuth, clock }) => {
    await configureApp(api, mockAuth, mockUsbDrive);

    simulateScan(mockScanner, await ballotImages.wrongElection(), clock);
    await waitForStatus(api, {
      state: 'rejecting',
      interpretation,
    });

    mockScanner.getStatus.mockResolvedValue(err(ErrorCode.ScannerOffline));
    clock.increment(delays.DELAY_PAPER_STATUS_POLLING_INTERVAL);
    await waitForStatus(api, { state: 'disconnected' });

    mockScanner.getStatus.mockResolvedValue(ok(mocks.MOCK_INTERNAL_JAM));
    clock.increment(delays.DELAY_RECONNECT);
    await waitForStatus(api, { state: 'jammed' });
  });
});

test('scanner powered off while returning', async () => {
  const interpretation = needsReviewInterpretation;
  await withApp(async ({ api, mockScanner, mockUsbDrive, mockAuth, clock }) => {
    await configureApp(api, mockAuth, mockUsbDrive, {
      electionPackage:
        electionGridLayoutNewHampshireTestBallotFixtures.electionJson.toElectionPackage(
          {
            ...DEFAULT_SYSTEM_SETTINGS,
            precinctScanAdjudicationReasons: [AdjudicationReason.BlankBallot],
          }
        ),
    });

    simulateScan(mockScanner, await ballotImages.unmarkedHmpb(), clock);
    await waitForStatus(api, { state: 'needs_review', interpretation });

    api.returnBallot();
    await waitForStatus(api, {
      state: 'returning',
      interpretation,
    });

    mockScanner.getStatus.mockResolvedValue(err(ErrorCode.ScannerOffline));
    clock.increment(delays.DELAY_PAPER_STATUS_POLLING_INTERVAL);
    await waitForStatus(api, { state: 'disconnected' });

    mockScanner.getStatus.mockResolvedValue(ok(mocks.MOCK_INTERNAL_JAM));
    clock.increment(delays.DELAY_RECONNECT);
    await waitForStatus(api, { state: 'jammed' });
  });
});

test('scanner powered off after returning', async () => {
  const interpretation = needsReviewInterpretation;
  await withApp(async ({ api, mockScanner, mockUsbDrive, mockAuth, clock }) => {
    await configureApp(api, mockAuth, mockUsbDrive, {
      electionPackage:
        electionGridLayoutNewHampshireTestBallotFixtures.electionJson.toElectionPackage(
          {
            ...DEFAULT_SYSTEM_SETTINGS,
            precinctScanAdjudicationReasons: [AdjudicationReason.BlankBallot],
          }
        ),
    });

    simulateScan(mockScanner, await ballotImages.unmarkedHmpb(), clock);
    await waitForStatus(api, { state: 'needs_review', interpretation });

    api.returnBallot();
    await waitForStatus(api, {
      state: 'returning',
      interpretation,
    });
    mockScanner.getStatus.mockResolvedValue(ok(mocks.MOCK_READY_TO_SCAN));
    clock.increment(delays.DELAY_PAPER_STATUS_POLLING_INTERVAL);
    await waitForStatus(api, {
      state: 'returned',
      interpretation,
    });

    mockScanner.getStatus.mockResolvedValue(err(ErrorCode.ScannerOffline));
    clock.increment(delays.DELAY_PAPER_STATUS_POLLING_INTERVAL);
    await waitForStatus(api, { state: 'disconnected' });

    mockScanner.getStatus.mockResolvedValue(ok(mocks.MOCK_READY_TO_SCAN));
    clock.increment(delays.DELAY_RECONNECT);
    await waitForStatus(api, {
      state: 'rejected',
      error: 'paper_in_front_after_reconnect',
    });
  });
});
