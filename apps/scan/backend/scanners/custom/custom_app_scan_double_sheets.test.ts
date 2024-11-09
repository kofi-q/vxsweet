jest.mock('@vx/libs/utils/src', (): typeof import('@vx/libs/utils/src') => {
  return {
    ...jest.requireActual('@vx/libs/utils/src'),
    isFeatureFlagEnabled: (flag) => mockFeatureFlagger.isEnabled(flag),
  };
});

import { deferred } from '@vx/libs/basics/async';
import { err, ok, type Result } from '@vx/libs/basics/result';
import {
  ErrorCode,
  type ImageFromScanner,
  mocks,
} from '@vx/libs/custom-scanner/src';
import { electionGridLayoutNewHampshireTestBallotFixtures } from '@vx/libs/fixtures/src';
import {
  AdjudicationReason,
  type AdjudicationReasonInfo,
  DEFAULT_SYSTEM_SETTINGS,
  type SheetOf,
} from '@vx/libs/types/elections';
import { type SheetInterpretation } from '@vx/libs/types/scanning';
import {
  BooleanEnvironmentVariableName,
  getFeatureFlagMock,
} from '@vx/libs/utils/src';
import {
  ballotImages,
  simulateScan,
  withApp,
} from '../../test/helpers/custom_helpers';
import { configureApp, waitForStatus } from '../../test/helpers/shared_helpers';
import { delays } from './state_machine';

jest.setTimeout(20_000);

const mockFeatureFlagger = getFeatureFlagMock();

beforeEach(() => {
  mockFeatureFlagger.enableFeatureFlag(
    BooleanEnvironmentVariableName.SKIP_ELECTION_PACKAGE_AUTHENTICATION
  );
  mockFeatureFlagger.enableFeatureFlag(
    BooleanEnvironmentVariableName.USE_CUSTOM_SCANNER
  );
});

test('insert second ballot before first ballot accept', async () => {
  await withApp(async ({ api, mockScanner, mockUsbDrive, mockAuth, clock }) => {
    await configureApp(api, mockAuth, mockUsbDrive, { testMode: true });

    mockScanner.getStatus.mockResolvedValue(ok(mocks.MOCK_READY_TO_SCAN));

    const scanDeferred =
      deferred<Result<SheetOf<ImageFromScanner>, ErrorCode>>();
    mockScanner.scan.mockResolvedValue(scanDeferred.promise);
    clock.increment(delays.DELAY_PAPER_STATUS_POLLING_INTERVAL);
    await waitForStatus(api, { state: 'scanning' });
    scanDeferred.resolve(ok(await ballotImages.completeBmd()));

    mockScanner.getStatus.mockResolvedValue(
      ok(mocks.MOCK_BOTH_SIDES_HAVE_PAPER)
    );
    clock.increment(delays.DELAY_PAPER_STATUS_POLLING_INTERVAL);
    await waitForStatus(api, { state: 'both_sides_have_paper' });

    const interpretation: SheetInterpretation = {
      type: 'ValidSheet',
    };
    mockScanner.getStatus.mockResolvedValue(ok(mocks.MOCK_READY_TO_EJECT));
    clock.increment(delays.DELAY_PAPER_STATUS_POLLING_INTERVAL);
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

    clock.increment(delays.DELAY_ACCEPTED_READY_FOR_NEXT_BALLOT);
    await waitForStatus(api, {
      state: 'no_paper',
      ballotsCounted: 1,
    });
  });
});

test('insert second ballot while first ballot is accepting', async () => {
  const interpretation: SheetInterpretation = {
    type: 'ValidSheet',
  };
  await withApp(async ({ api, mockScanner, mockUsbDrive, mockAuth, clock }) => {
    await configureApp(api, mockAuth, mockUsbDrive, { testMode: true });

    mockScanner.getStatus.mockResolvedValue(ok(mocks.MOCK_READY_TO_SCAN));
    simulateScan(mockScanner, await ballotImages.completeBmd(), clock);

    await waitForStatus(api, {
      state: 'accepting',
      interpretation,
    });

    mockScanner.getStatus.mockResolvedValue(
      ok(mocks.MOCK_BOTH_SIDES_HAVE_PAPER)
    );
    clock.increment(delays.DELAY_PAPER_STATUS_POLLING_INTERVAL_DURING_ACCEPT);
    await waitForStatus(api, {
      state: 'accepted',
      interpretation,
      ballotsCounted: 1,
    });

    clock.increment(delays.DELAY_ACCEPTED_READY_FOR_NEXT_BALLOT);
    await waitForStatus(api, {
      state: 'returning_to_rescan',
      ballotsCounted: 1,
    });
  });
});

test('insert second ballot while first ballot needs review', async () => {
  const interpretation: SheetInterpretation = {
    type: 'NeedsReviewSheet',
    reasons: [
      expect.objectContaining<Partial<AdjudicationReasonInfo>>({
        type: AdjudicationReason.Overvote,
      }),
    ],
  };
  await withApp(async ({ api, mockScanner, mockUsbDrive, mockAuth, clock }) => {
    await configureApp(api, mockAuth, mockUsbDrive, {
      electionPackage:
        electionGridLayoutNewHampshireTestBallotFixtures.electionJson.toElectionPackage(
          {
            ...DEFAULT_SYSTEM_SETTINGS,
            precinctScanAdjudicationReasons: [AdjudicationReason.Overvote],
          }
        ),
    });

    // set up deferred scan result
    const scanDeferred =
      deferred<Result<SheetOf<ImageFromScanner>, ErrorCode>>();
    mockScanner.scan.mockResolvedValue(scanDeferred.promise);

    // mark as ready and trigger the scan
    mockScanner.getStatus.mockResolvedValue(ok(mocks.MOCK_READY_TO_SCAN));
    clock.increment(delays.DELAY_PAPER_STATUS_POLLING_INTERVAL);

    // ensure we're scanning before we release the deferred scan result
    await waitForStatus(api, { state: 'scanning' });

    // switch to being ready to eject with the scan result
    mockScanner.getStatus.mockResolvedValue(ok(mocks.MOCK_READY_TO_EJECT));
    scanDeferred.resolve(ok(await ballotImages.overvoteHmpb()));
    clock.increment(delays.DELAY_PAPER_STATUS_POLLING_INTERVAL);

    // now we're in review
    await waitForStatus(api, { state: 'needs_review', interpretation });

    // simulate another sheet of paper being inserted in front
    mockScanner.getStatus.mockResolvedValue(
      ok(mocks.MOCK_BOTH_SIDES_HAVE_PAPER)
    );
    clock.increment(delays.DELAY_PAPER_STATUS_POLLING_INTERVAL);

    // we can't accept the in-review ballot
    await waitForStatus(api, {
      state: 'both_sides_have_paper',
      interpretation,
    });

    // simulate removing the paper from the front
    mockScanner.getStatus.mockResolvedValue(ok(mocks.MOCK_READY_TO_EJECT));
    clock.increment(delays.DELAY_PAPER_STATUS_POLLING_INTERVAL);

    // now we're back to review
    await waitForStatus(api, { state: 'needs_review', interpretation });

    // trigger accepting the ballot
    api.acceptBallot();
    await waitForStatus(api, {
      state: 'accepting_after_review',
      interpretation,
    });

    mockScanner.getStatus.mockResolvedValue(ok(mocks.MOCK_NO_PAPER));
    clock.increment(delays.DELAY_PAPER_STATUS_POLLING_INTERVAL_DURING_ACCEPT);
    await waitForStatus(api, {
      state: 'accepted',
      interpretation,
      ballotsCounted: 1,
    });
  });
});

test('double sheet on scan', async () => {
  await withApp(async ({ api, mockScanner, mockUsbDrive, mockAuth, clock }) => {
    await configureApp(api, mockAuth, mockUsbDrive);

    mockScanner.scan.mockImplementation(() => {
      mockScanner.getStatus.mockResolvedValue(ok(mocks.MOCK_DOUBLE_SHEET));
      return Promise.resolve(err(ErrorCode.PaperJam));
    });

    mockScanner.getStatus.mockResolvedValue(ok(mocks.MOCK_READY_TO_SCAN));
    clock.increment(delays.DELAY_PAPER_STATUS_POLLING_INTERVAL);
    await waitForStatus(api, { state: 'scanning' });
    clock.increment(delays.DELAY_JAM_WHEN_SCANNING);
    await waitForStatus(api, { state: 'double_sheet_jammed' });

    mockScanner.getStatus.mockResolvedValue(ok(mocks.MOCK_JAM_CLEARED));
    clock.increment(delays.DELAY_PAPER_STATUS_POLLING_INTERVAL);
    await waitForStatus(api, { state: 'double_sheet_jammed' });
    expect(mockScanner.resetHardware).toHaveBeenCalled();
    mockScanner.getStatus.mockResolvedValue(ok(mocks.MOCK_NO_PAPER));
    clock.increment(delays.DELAY_PAPER_STATUS_POLLING_INTERVAL);
    await waitForStatus(api, { state: 'no_paper' });
  });
});
