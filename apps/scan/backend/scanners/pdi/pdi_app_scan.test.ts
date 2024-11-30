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
import * as electionGridLayoutNewHampshireTestBallotFixtures from '@vx/libs/fixtures/src/data/electionGridLayoutNewHampshireTestBallot';
import { err } from '@vx/libs/basics/result';
import { typedAs } from '@vx/libs/basics/types';
import {
  AdjudicationReason,
  type AdjudicationReasonInfo,
  DEFAULT_SYSTEM_SETTINGS,
} from '@vx/libs/types/elections';
import { type SheetInterpretation } from '@vx/libs/types/scanning';
import { DEFAULT_FAMOUS_NAMES_PRECINCT_ID } from '@vx/libs/bmd-ballot-fixtures/src';
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

test('configure and scan hmpb', async () => {
  await withApp(
    async ({ api, mockScanner, mockUsbDrive, mockAuth, logger, clock }) => {
      await configureApp(api, mockAuth, mockUsbDrive, {
        electionPackage:
          electionGridLayoutNewHampshireTestBallotFixtures.electionJson.toElectionPackage(),
      });

      clock.increment(delays.DELAY_SCANNING_ENABLED_POLLING_INTERVAL);
      await waitForStatus(api, { state: 'no_paper' });
      expect(mockScanner.client.enableScanning).toHaveBeenCalledWith({
        doubleFeedDetectionEnabled: true,
        paperLengthInches: 11,
      });

      simulateScan(api, mockScanner, await ballotImages.completeHmpb());

      const interpretation: SheetInterpretation = { type: 'ValidSheet' };
      await waitForStatus(api, {
        state: 'accepting',
        interpretation,
      });
      expect(mockScanner.client.ejectDocument).toHaveBeenCalledWith('toRear');
      mockScanner.setScannerStatus(mockStatus.idleScanningDisabled);
      clock.increment(delays.DELAY_SCANNER_STATUS_POLLING_INTERVAL);
      await waitForStatus(api, {
        state: 'accepted',
        interpretation,
        ballotsCounted: 1,
      });

      // Test waiting for automatic transition back to no_paper
      clock.increment(delays.DELAY_ACCEPTED_READY_FOR_NEXT_BALLOT);
      await waitForStatus(api, { state: 'no_paper', ballotsCounted: 1 });

      // Do some basic logging checks to ensure that we're logging state machine changes
      // Make sure we got a transition
      expect(logger.log).toHaveBeenCalledWith(
        'scanner-state-machine-transition',
        'system',
        {
          message: 'Transitioned to: {"waitingForBallot":"checkingStatus"}',
          newState: '{"waitingForBallot":"checkingStatus"}',
        },
        expect.any(Function)
      );
      // Make sure we got an event
      expect(logger.log).toHaveBeenCalledWith(
        'scanner-state-machine-event',
        'system',
        {
          message: 'Event: SCANNER_STATUS',
          eventObject: expect.stringContaining('"documentInScanner":false'),
        },
        expect.any(Function)
      );
      // Make sure we got a context update. And make sure we didn't log the votes in
      // the interpretation to protect voter privacy.
      expect(logger.log).toHaveBeenCalledWith(
        'scanner-state-machine-transition',
        'system',
        {
          message: 'Context updated',
          changedFields: expect.stringMatching(
            /"type":"ValidSheet".*"votes":"\[hidden\]"/
          ),
        },
        expect.any(Function)
      );
    }
  );
});

test('configure and scan bmd ballot', async () => {
  await withApp(async ({ api, mockScanner, mockUsbDrive, mockAuth, clock }) => {
    await configureApp(api, mockAuth, mockUsbDrive, {
      testMode: true,
      precinctId: DEFAULT_FAMOUS_NAMES_PRECINCT_ID,
    });

    clock.increment(delays.DELAY_SCANNING_ENABLED_POLLING_INTERVAL);
    await waitForStatus(api, { state: 'no_paper' });
    expect(mockScanner.client.enableScanning).toHaveBeenCalledWith({
      doubleFeedDetectionEnabled: true,
      paperLengthInches: 11,
    });

    simulateScan(api, mockScanner, await ballotImages.completeBmd());

    const interpretation: SheetInterpretation = { type: 'ValidSheet' };
    await waitForStatus(api, {
      state: 'accepting',
      interpretation,
    });
    expect(mockScanner.client.ejectDocument).toHaveBeenCalledWith('toRear');
    mockScanner.setScannerStatus(mockStatus.idleScanningDisabled);
    clock.increment(delays.DELAY_SCANNER_STATUS_POLLING_INTERVAL);

    await waitForStatus(api, {
      state: 'accepted',
      interpretation,
      ballotsCounted: 1,
    });
  });
});

test('ballot needs review - return', async () => {
  await withApp(
    async ({ api, mockScanner, mockUsbDrive, mockAuth, workspace, clock }) => {
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
      await waitForStatus(api, { state: 'needs_review', interpretation });

      api.returnBallot();
      expectStatus(api, { state: 'returning', interpretation });
      expect(mockScanner.client.ejectDocument).toHaveBeenCalledWith(
        'toFrontAndHold'
      );
      mockScanner.setScannerStatus(mockStatus.documentInFront);
      clock.increment(delays.DELAY_SCANNER_STATUS_POLLING_INTERVAL);

      await waitForStatus(api, { state: 'returned', interpretation });

      // Simulate voter removing ballot
      mockScanner.setScannerStatus(mockStatus.idleScanningDisabled);
      clock.increment(delays.DELAY_SCANNER_STATUS_POLLING_INTERVAL);
      await waitForStatus(api, { state: 'no_paper' });

      // Make sure the ballot was still recorded in the db for backup purposes
      expect(Array.from(workspace.store.forEachSheet())).toHaveLength(1);
    }
  );
});

test('ballot needs review - accept', async () => {
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
    await waitForStatus(api, { state: 'needs_review', interpretation });

    api.acceptBallot();
    expectStatus(api, {
      state: 'accepting_after_review',
      interpretation,
    });
    expect(mockScanner.client.ejectDocument).toHaveBeenCalledWith('toRear');
    mockScanner.setScannerStatus(mockStatus.idleScanningDisabled);
    clock.increment(delays.DELAY_SCANNER_STATUS_POLLING_INTERVAL);

    await waitForStatus(api, {
      state: 'accepted',
      interpretation,
      ballotsCounted: 1,
    });
  });
});

test('ballot with wrong election rejected', async () => {
  await withApp(
    async ({ api, mockScanner, mockUsbDrive, mockAuth, workspace, clock }) => {
      await configureApp(api, mockAuth, mockUsbDrive);

      clock.increment(delays.DELAY_SCANNING_ENABLED_POLLING_INTERVAL);
      await waitForStatus(api, { state: 'no_paper' });

      simulateScan(api, mockScanner, await ballotImages.wrongElectionBmd());

      const interpretation: SheetInterpretation = {
        type: 'InvalidSheet',
        reason: 'invalid_ballot_hash',
      };
      await waitForStatus(api, { state: 'rejecting', interpretation });
      expect(mockScanner.client.ejectDocument).toHaveBeenCalledWith(
        'toFrontAndHold'
      );
      mockScanner.setScannerStatus(mockStatus.documentInFront);
      clock.increment(delays.DELAY_SCANNER_STATUS_POLLING_INTERVAL);

      await waitForStatus(api, { state: 'rejected', interpretation });

      // Simulate voter removing ballot
      mockScanner.setScannerStatus(mockStatus.idleScanningDisabled);
      clock.increment(delays.DELAY_SCANNER_STATUS_POLLING_INTERVAL);
      await waitForStatus(api, { state: 'no_paper' });

      // Make sure the ballot was still recorded in the db for backup purposes
      expect(Array.from(workspace.store.forEachSheet())).toHaveLength(1);
    }
  );
});

test('ballot with wrong precinct rejected', async () => {
  await withApp(async ({ api, mockScanner, mockUsbDrive, mockAuth, clock }) => {
    await configureApp(api, mockAuth, mockUsbDrive, {
      precinctId: '22',
      testMode: true,
    });

    clock.increment(delays.DELAY_SCANNING_ENABLED_POLLING_INTERVAL);
    await waitForStatus(api, { state: 'no_paper' });

    simulateScan(api, mockScanner, await ballotImages.completeBmd());

    clock.increment(delays.DELAY_SCANNING_ENABLED_POLLING_INTERVAL);
    const interpretation: SheetInterpretation = {
      type: 'InvalidSheet',
      reason: 'invalid_precinct',
    };
    await waitForStatus(api, { state: 'rejecting', interpretation });
    expect(mockScanner.client.ejectDocument).toHaveBeenCalledWith(
      'toFrontAndHold'
    );
    mockScanner.setScannerStatus(mockStatus.documentInFront);
    clock.increment(delays.DELAY_SCANNER_STATUS_POLLING_INTERVAL);

    await waitForStatus(api, { state: 'rejected', interpretation });
  });
});

test('blank sheet rejected', async () => {
  await withApp(async ({ api, mockScanner, mockUsbDrive, mockAuth, clock }) => {
    await configureApp(api, mockAuth, mockUsbDrive);

    clock.increment(delays.DELAY_SCANNING_ENABLED_POLLING_INTERVAL);
    await waitForStatus(api, { state: 'no_paper' });

    simulateScan(api, mockScanner, await ballotImages.blankSheet());

    const interpretation: SheetInterpretation = {
      type: 'InvalidSheet',
      reason: 'unknown',
    };
    await waitForStatus(api, { state: 'rejecting', interpretation });
    expect(mockScanner.client.ejectDocument).toHaveBeenCalledWith(
      'toFrontAndHold'
    );
    mockScanner.setScannerStatus(mockStatus.documentInFront);
    clock.increment(delays.DELAY_SCANNER_STATUS_POLLING_INTERVAL);

    await waitForStatus(api, { state: 'rejected', interpretation });
  });
});

test('if scan fails, ballot rejected', async () => {
  await withApp(async ({ api, mockScanner, mockUsbDrive, mockAuth, clock }) => {
    await configureApp(api, mockAuth, mockUsbDrive);

    clock.increment(delays.DELAY_SCANNING_ENABLED_POLLING_INTERVAL);
    await waitForStatus(api, { state: 'no_paper' });

    mockScanner.emitEvent({ event: 'scanStart' });
    expectStatus(api, { state: 'scanning' });
    mockScanner.setScannerStatus(mockStatus.documentInRear);
    mockScanner.emitEvent({ event: 'error', code: 'scanFailed' });

    await waitForStatus(api, {
      state: 'rejecting',
      error: 'scanning_failed',
    });
    expect(mockScanner.client.ejectDocument).toHaveBeenCalledWith(
      'toFrontAndHold'
    );
    mockScanner.setScannerStatus(mockStatus.documentInFront);
    clock.increment(delays.DELAY_SCANNER_STATUS_POLLING_INTERVAL);

    await waitForStatus(api, {
      state: 'rejected',
      error: 'scanning_failed',
    });
  });
});

test('if ballot removed during scan, returns to waiting for ballots', async () => {
  await withApp(async ({ api, mockScanner, mockUsbDrive, mockAuth, clock }) => {
    await configureApp(api, mockAuth, mockUsbDrive);

    clock.increment(delays.DELAY_SCANNING_ENABLED_POLLING_INTERVAL);
    await waitForStatus(api, { state: 'no_paper' });

    mockScanner.emitEvent({ event: 'scanStart' });
    expectStatus(api, { state: 'scanning' });
    mockScanner.setScannerStatus(mockStatus.idleScanningEnabled);
    mockScanner.emitEvent({
      event: 'scanComplete',
      images: await ballotImages.blankSheet(), // Shouldn't matter
    });

    clock.increment(delays.DELAY_SCANNER_STATUS_POLLING_INTERVAL);
    await waitForStatus(api, { state: 'no_paper' });
  });
});

test('if interpretation throws an exception, show unrecoverable error', async () => {
  await withApp(
    async ({ api, mockScanner, mockUsbDrive, mockAuth, clock, logger }) => {
      await configureApp(api, mockAuth, mockUsbDrive);

      clock.increment(delays.DELAY_SCANNING_ENABLED_POLLING_INTERVAL);
      await waitForStatus(api, { state: 'no_paper' });

      mockScanner.emitEvent({ event: 'scanStart' });
      expectStatus(api, { state: 'scanning' });
      mockScanner.setScannerStatus(mockStatus.documentInRear);
      mockScanner.emitEvent({
        event: 'scanComplete',
        // @ts-expect-error This shouldn't ever happen, but it's a way to
        // trigger an exception in the interpretation function
        images: [],
      });

      await waitForStatus(api, {
        state: 'unrecoverable_error',
      });
      // Make sure the underlying error got logged correctly
      expect(logger.log).toHaveBeenCalledWith(
        'scanner-state-machine-transition',
        'system',
        {
          message: 'Context updated',
          changedFields: expect.stringMatching(/{"error":.*TypeError/),
        },
        expect.any(Function)
      );
    }
  );
});

test('if scanning times out, show unrecoverable error', async () => {
  await withApp(
    async ({ api, mockScanner, mockUsbDrive, mockAuth, clock, logger }) => {
      await configureApp(api, mockAuth, mockUsbDrive);

      clock.increment(delays.DELAY_SCANNING_ENABLED_POLLING_INTERVAL);
      await waitForStatus(api, { state: 'no_paper' });

      mockScanner.setScannerStatus(mockStatus.documentInFront);
      mockScanner.emitEvent({ event: 'scanStart' });
      expectStatus(api, { state: 'scanning' });
      mockScanner.setScannerStatus(mockStatus.documentInRear);

      clock.increment(delays.DELAY_SCANNING_TIMEOUT);
      await waitForStatus(api, {
        state: 'unrecoverable_error',
      });

      // Make sure the underlying error got logged correctly
      expect(logger.log).toHaveBeenCalledWith(
        'scanner-state-machine-transition',
        'system',
        {
          message: 'Context updated',
          changedFields: expect.stringMatching(
            /{"error":{"type":"scanning_timed_out","message":"scanning_timed_out","stack":".*"}}/
          ),
        },
        expect.any(Function)
      );
    }
  );
});

test('if scanner status errors, show unrecoverable error', async () => {
  await withApp(async ({ api, mockScanner, mockUsbDrive, mockAuth, clock }) => {
    mockScanner.client.getScannerStatus.mockResolvedValue(
      err({ code: 'other', message: 'some error' })
    );
    await configureApp(api, mockAuth, mockUsbDrive);
    clock.increment(delays.DELAY_SCANNING_ENABLED_POLLING_INTERVAL);
    await waitForStatus(api, {
      state: 'unrecoverable_error',
    });
  });
});
