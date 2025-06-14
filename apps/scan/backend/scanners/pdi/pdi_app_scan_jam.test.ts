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
import { type Result, ok } from '@vx/libs/basics/result';
import { deferred } from '@vx/libs/basics/async';
import { typedAs } from '@vx/libs/basics/types';
import { type ScannerError } from '@vx/libs/pdi-scanner/src/ts';
import * as electionGridLayoutNewHampshireTestBallotFixtures from '@vx/libs/fixtures/src/data/electionGridLayoutNewHampshireTestBallot';
import {
  AdjudicationReason,
  type AdjudicationReasonInfo,
  DEFAULT_SYSTEM_SETTINGS,
} from '@vx/libs/types/elections';
import { type SheetInterpretation } from '@vx/libs/types/scanning';
import {
  ballotImages,
  mockStatus,
  simulateScan,
  withApp,
} from '../../test/helpers/pdi_helpers';
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

test('jam while scanning', async () => {
  await withApp(async ({ api, mockScanner, mockUsbDrive, mockAuth, clock }) => {
    await configureApp(api, mockAuth, mockUsbDrive);

    clock.increment(delays.DELAY_SCANNING_ENABLED_POLLING_INTERVAL);
    await waitForStatus(api, { state: 'no_paper' });

    mockScanner.emitEvent({ event: 'scanStart' });
    expectStatus(api, { state: 'scanning' });

    mockScanner.setScannerStatus(mockStatus.jammed);
    const deferredEject = deferred<Result<void, ScannerError>>();
    mockScanner.client.ejectDocument.mockReturnValueOnce(deferredEject.promise);
    mockScanner.emitEvent({ event: 'error', code: 'scanFailed' });
    await waitForStatus(api, {
      state: 'rejecting',
      error: 'scanning_failed',
    });
    deferredEject.resolve(ok());
    await waitForStatus(api, {
      state: 'jammed',
      error: 'scanning_failed',
    });

    mockScanner.setScannerStatus(mockStatus.idleScanningDisabled);
    clock.increment(delays.DELAY_SCANNER_STATUS_POLLING_INTERVAL);
    await waitForStatus(api, { state: 'no_paper' });
  });
});

test('jam while accepting', async () => {
  await withApp(async ({ api, mockScanner, mockUsbDrive, mockAuth, clock }) => {
    await configureApp(api, mockAuth, mockUsbDrive, {
      electionPackage:
        electionGridLayoutNewHampshireTestBallotFixtures.electionJson.toElectionPackage(),
    });

    clock.increment(delays.DELAY_SCANNING_ENABLED_POLLING_INTERVAL);
    await waitForStatus(api, { state: 'no_paper' });

    simulateScan(api, mockScanner, await ballotImages.completeHmpb());

    const interpretation: SheetInterpretation = { type: 'ValidSheet' };
    const deferredAccept = deferred<Result<void, ScannerError>>();
    mockScanner.client.ejectDocument.mockReturnValueOnce(
      deferredAccept.promise
    );
    await waitForStatus(api, {
      state: 'accepting',
      interpretation,
    });

    mockScanner.setScannerStatus(mockStatus.jammed);
    deferredAccept.resolve(ok());

    await waitForStatus(api, {
      state: 'accepted',
      interpretation,
      ballotsCounted: 1,
    });
    clock.increment(delays.DELAY_ACCEPTED_READY_FOR_NEXT_BALLOT);
    await waitForStatus(api, {
      state: 'jammed',
      error: 'outfeed_blocked',
      ballotsCounted: 1,
    });

    mockScanner.setScannerStatus(mockStatus.idleScanningDisabled);
    clock.increment(delays.DELAY_SCANNER_STATUS_POLLING_INTERVAL);
    await waitForStatus(api, { state: 'no_paper', ballotsCounted: 1 });
  });
});

// If the ballot gets blocked from being ejected on accept, we often don't get a
// jam status, but hit the timeout case instead.
test('timeout while accepting', async () => {
  await withApp(async ({ api, mockScanner, mockUsbDrive, mockAuth, clock }) => {
    await configureApp(api, mockAuth, mockUsbDrive, {
      electionPackage:
        electionGridLayoutNewHampshireTestBallotFixtures.electionJson.toElectionPackage(),
    });

    clock.increment(delays.DELAY_SCANNING_ENABLED_POLLING_INTERVAL);
    await waitForStatus(api, { state: 'no_paper' });

    simulateScan(api, mockScanner, await ballotImages.completeHmpb());

    const interpretation: SheetInterpretation = { type: 'ValidSheet' };
    await waitForStatus(api, {
      state: 'accepting',
      interpretation,
    });

    clock.increment(delays.DELAY_ACCEPTING_TIMEOUT);
    await waitForStatus(api, {
      state: 'accepted',
      interpretation,
      ballotsCounted: 1,
    });

    clock.increment(delays.DELAY_ACCEPTED_READY_FOR_NEXT_BALLOT);
    await waitForStatus(api, {
      state: 'jammed',
      error: 'outfeed_blocked',
      ballotsCounted: 1,
    });

    mockScanner.setScannerStatus(mockStatus.idleScanningDisabled);
    clock.increment(delays.DELAY_SCANNER_STATUS_POLLING_INTERVAL);
    await waitForStatus(api, { state: 'no_paper', ballotsCounted: 1 });
  });
});

test('jam while rejecting', async () => {
  await withApp(async ({ api, mockScanner, mockUsbDrive, mockAuth, clock }) => {
    await configureApp(api, mockAuth, mockUsbDrive);

    clock.increment(delays.DELAY_SCANNING_ENABLED_POLLING_INTERVAL);
    await waitForStatus(api, { state: 'no_paper' });

    simulateScan(api, mockScanner, await ballotImages.wrongElectionBmd());

    const interpretation: SheetInterpretation = {
      type: 'InvalidSheet',
      reason: 'invalid_ballot_hash',
    };
    const deferredEject = deferred<Result<void, ScannerError>>();
    mockScanner.client.ejectDocument.mockReturnValueOnce(deferredEject.promise);
    await waitForStatus(api, {
      state: 'rejecting',
      interpretation,
    });

    mockScanner.setScannerStatus(mockStatus.jammed);
    deferredEject.resolve(ok());
    await waitForStatus(api, { state: 'jammed', interpretation });

    mockScanner.setScannerStatus(mockStatus.idleScanningDisabled);
    clock.increment(delays.DELAY_SCANNER_STATUS_POLLING_INTERVAL);
    await waitForStatus(api, { state: 'no_paper' });
  });
});

test('jam while returning', async () => {
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

    clock.increment(delays.DELAY_SCANNING_ENABLED_POLLING_INTERVAL);
    await waitForStatus(api, { state: 'no_paper' });

    simulateScan(api, mockScanner, await ballotImages.overvoteHmpb());

    const interpretation: SheetInterpretation = {
      type: 'NeedsReviewSheet',
      reasons: [
        expect.objectContaining(
          typedAs<Partial<AdjudicationReasonInfo>>({
            type: AdjudicationReason.Overvote,
          })
        ),
      ],
    };
    await waitForStatus(api, {
      state: 'needs_review',
      interpretation,
    });

    const deferredEject = deferred<Result<void, ScannerError>>();
    mockScanner.client.ejectDocument.mockReturnValueOnce(deferredEject.promise);
    api.returnBallot();
    expectStatus(api, { state: 'returning', interpretation });

    mockScanner.setScannerStatus(mockStatus.jammed);
    deferredEject.resolve(ok());
    await waitForStatus(api, { state: 'jammed', interpretation });

    mockScanner.setScannerStatus(mockStatus.idleScanningDisabled);
    clock.increment(delays.DELAY_SCANNER_STATUS_POLLING_INTERVAL);
    await waitForStatus(api, { state: 'no_paper' });
  });
});
