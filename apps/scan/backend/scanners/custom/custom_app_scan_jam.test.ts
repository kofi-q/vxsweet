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
import { ok } from '@vx/libs/basics/result';
import { mocks } from '@vx/libs/custom-scanner/src';
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

test('jam on scan', async () => {
  await withApp(async ({ api, mockScanner, mockUsbDrive, mockAuth, clock }) => {
    await configureApp(api, mockAuth, mockUsbDrive);

    mockScanner.scan.mockImplementation(() => {
      mockScanner.getStatus.mockResolvedValue(ok(mocks.MOCK_INTERNAL_JAM));
      // Returns an intentionally broken value to trigger a reconnect.
      return Promise.resolve(ok()) as ReturnType<typeof mockScanner.scan>;
    });

    mockScanner.getStatus.mockResolvedValue(ok(mocks.MOCK_READY_TO_SCAN));
    clock.increment(delays.DELAY_PAPER_STATUS_POLLING_INTERVAL);

    await waitForStatus(api, {
      state: 'recovering_from_error',
      error: 'client_error',
    });

    mockScanner.getStatus.mockResolvedValue(ok(mocks.MOCK_NO_PAPER));
    clock.increment(delays.DELAY_RECONNECT_ON_UNEXPECTED_ERROR);
    await waitForStatus(api, { state: 'no_paper' });
  });
});

test('jam on accept', async () => {
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
    clock.increment(delays.DELAY_ACCEPTING_TIMEOUT);
    // The paper can't get permanently jammed on accept - it just stays held in
    // the back and we can reject at that point
    await waitForStatus(api, {
      state: 'rejecting',
      interpretation,
      error: 'paper_in_back_after_accept',
    });

    mockScanner.getStatus.mockResolvedValue(ok(mocks.MOCK_READY_TO_SCAN));
    clock.increment(delays.DELAY_PAPER_STATUS_POLLING_INTERVAL);
    await waitForStatus(api, {
      state: 'rejected',
      error: 'paper_in_back_after_accept',
      interpretation,
    });

    mockScanner.getStatus.mockResolvedValue(ok(mocks.MOCK_NO_PAPER));
    clock.increment(delays.DELAY_PAPER_STATUS_POLLING_INTERVAL);
    await waitForStatus(api, { state: 'no_paper' });
  });
});

test('jam on return', async () => {
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

    mockScanner.getStatus.mockResolvedValue(ok(mocks.MOCK_INTERNAL_JAM));
    api.returnBallot();
    await waitForStatus(api, {
      state: 'jammed',
      interpretation,
    });

    mockScanner.getStatus.mockResolvedValue(ok(mocks.MOCK_NO_PAPER));
    clock.increment(delays.DELAY_PAPER_STATUS_POLLING_INTERVAL);
    await waitForStatus(api, { state: 'no_paper' });
  });
});

test('jam on reject', async () => {
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
    mockScanner.getStatus.mockResolvedValue(ok(mocks.MOCK_INTERNAL_JAM));
    clock.increment(delays.DELAY_PAPER_STATUS_POLLING_INTERVAL);
    await waitForStatus(api, {
      state: 'jammed',
      interpretation,
    });

    mockScanner.getStatus.mockResolvedValue(ok(mocks.MOCK_NO_PAPER));
    clock.increment(delays.DELAY_PAPER_STATUS_POLLING_INTERVAL);
    await waitForStatus(api, { state: 'no_paper' });
  });
});
