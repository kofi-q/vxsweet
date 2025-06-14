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
import { type Result, err, ok } from '@vx/libs/basics/result';
import { deferred } from '@vx/libs/basics/async';
import { typedAs } from '@vx/libs/basics/types';
import { type ScannerError } from '@vx/libs/pdi-scanner/src/ts';
import {
  AdjudicationReason,
  type AdjudicationReasonInfo,
  DEFAULT_SYSTEM_SETTINGS,
} from '@vx/libs/types/elections';
import { type SheetInterpretation } from '@vx/libs/types/scanning';
import * as electionGridLayoutNewHampshireTestBallotFixtures from '@vx/libs/fixtures/src/data/electionGridLayoutNewHampshireTestBallot';
import { SimulatedClock } from 'xstate/lib/SimulatedClock';
import { buildMockInsertedSmartCardAuth } from '@vx/libs/auth/test-utils';
import { dirSync } from 'tmp';
import { createMockUsbDrive } from '@vx/libs/usb-drive/src';
import waitForExpect from 'wait-for-expect';
import { mockBaseLogger } from '@vx/libs/logging/src';
import {
  type MockPdiScannerClient,
  ballotImages,
  createMockPdiScannerClient,
  mockStatus,
  simulateScan,
  withApp,
} from '../../test/helpers/pdi_helpers';
import {
  configureApp,
  expectStatus,
  waitForStatus,
  buildMockLogger,
} from '../../test/helpers/shared_helpers';
import { createPrecinctScannerStateMachine, delays } from './state_machine';
import { createWorkspace } from '../../workspace/workspace';

jest.setTimeout(20_000);

const mockFeatureFlagger = getFeatureFlagMock();

beforeEach(() => {
  mockFeatureFlagger.enableFeatureFlag(
    BooleanEnvironmentVariableName.SKIP_ELECTION_PACKAGE_AUTHENTICATION
  );
});

function simulateDisconnect(mockScanner: MockPdiScannerClient) {
  mockScanner.client.getScannerStatus.mockResolvedValue(
    err({ code: 'disconnected' })
  );
  mockScanner.emitEvent({ event: 'error', code: 'disconnected' });
  mockScanner.client.connect.mockResolvedValue(err({ code: 'disconnected' }));
}

function simulateReconnect(
  mockScanner: MockPdiScannerClient,
  status = mockStatus.idleScanningDisabled
) {
  mockScanner.client.connect.mockResolvedValue(ok());
  mockScanner.setScannerStatus(status);
}

// Since `withApp` automatically connects, we can't use it for this test.
// Instead, we test the state machine directly, since we don't need the whole
// app in this case.
test('scanner disconnected on startup', async () => {
  const mockScanner = createMockPdiScannerClient();
  mockScanner.client.connect.mockResolvedValue(err({ code: 'disconnected' }));
  const clock = new SimulatedClock();
  const mockAuth = buildMockInsertedSmartCardAuth();
  const workspace = createWorkspace(dirSync().name, mockBaseLogger());
  const mockUsbDrive = createMockUsbDrive();
  const logger = buildMockLogger(mockAuth, workspace);
  const precinctScannerMachine = createPrecinctScannerStateMachine({
    auth: mockAuth,
    createScannerClient: () => mockScanner.client,
    workspace,
    logger,
    usbDrive: mockUsbDrive.usbDrive,
    clock,
  });

  expect(precinctScannerMachine.status()).toEqual({ state: 'connecting' });
  await waitForExpect(() => {
    expect(precinctScannerMachine.status()).toEqual({ state: 'disconnected' });
  });
  precinctScannerMachine.stop();
});

test('scanner disconnected while waiting for ballots', async () => {
  await withApp(async ({ api, mockScanner, mockUsbDrive, mockAuth, clock }) => {
    await configureApp(api, mockAuth, mockUsbDrive);

    clock.increment(delays.DELAY_SCANNING_ENABLED_POLLING_INTERVAL);
    await waitForStatus(api, { state: 'no_paper' });

    simulateDisconnect(mockScanner);
    await waitForStatus(api, { state: 'disconnected' });

    clock.increment(delays.DELAY_RECONNECT);
    await waitForStatus(api, { state: 'disconnected' });

    simulateReconnect(mockScanner);
    clock.increment(delays.DELAY_RECONNECT);
    await waitForStatus(api, { state: 'no_paper' });
  });
});

test('scanner disconnected while scanning', async () => {
  await withApp(async ({ api, mockScanner, mockUsbDrive, mockAuth, clock }) => {
    await configureApp(api, mockAuth, mockUsbDrive);

    clock.increment(delays.DELAY_SCANNING_ENABLED_POLLING_INTERVAL);
    await waitForStatus(api, { state: 'no_paper' });

    mockScanner.emitEvent({ event: 'scanStart' });
    expectStatus(api, { state: 'scanning' });

    simulateDisconnect(mockScanner);
    await waitForStatus(api, { state: 'disconnected' });

    simulateReconnect(mockScanner, mockStatus.jammed);
    const deferredEject = deferred<Result<void, ScannerError>>();
    mockScanner.client.ejectDocument.mockResolvedValueOnce(
      deferredEject.promise
    );
    clock.increment(delays.DELAY_RECONNECT);
    await waitForStatus(api, {
      state: 'rejecting',
      error: 'paper_in_back_after_reconnect',
    });

    mockScanner.setScannerStatus(mockStatus.documentInFront);
    deferredEject.resolve(ok());
    await waitForStatus(api, {
      state: 'rejected',
      error: 'paper_in_back_after_reconnect',
    });
  });
});

test('scanner disconnected while accepting', async () => {
  await withApp(async ({ api, mockScanner, mockUsbDrive, mockAuth, clock }) => {
    await configureApp(api, mockAuth, mockUsbDrive, {
      electionPackage:
        electionGridLayoutNewHampshireTestBallotFixtures.electionJson.toElectionPackage(),
    });

    clock.increment(delays.DELAY_SCANNING_ENABLED_POLLING_INTERVAL);
    await waitForStatus(api, { state: 'no_paper' });

    simulateScan(api, mockScanner, await ballotImages.completeHmpb());

    const interpretation: SheetInterpretation = { type: 'ValidSheet' };
    clock.increment(delays.DELAY_SCANNING_ENABLED_POLLING_INTERVAL);
    await waitForStatus(api, {
      state: 'accepting',
      interpretation,
    });

    simulateDisconnect(mockScanner);
    await waitForStatus(api, { state: 'disconnected' });

    simulateReconnect(mockScanner, mockStatus.documentInRear);
    clock.increment(delays.DELAY_RECONNECT);
    await waitForStatus(api, {
      state: 'rejecting',
      error: 'paper_in_back_after_reconnect',
    });
  });
});

// It's unlikely to actually disconnect during this exact moment, but it's
// useful to test this error handling path for coverage
test('scanner disconnected while accepting - ejectDocument fails', async () => {
  await withApp(async ({ api, mockScanner, mockUsbDrive, mockAuth, clock }) => {
    await configureApp(api, mockAuth, mockUsbDrive, {
      electionPackage:
        electionGridLayoutNewHampshireTestBallotFixtures.electionJson.toElectionPackage(),
    });

    clock.increment(delays.DELAY_SCANNING_ENABLED_POLLING_INTERVAL);
    await waitForStatus(api, { state: 'no_paper' });

    simulateScan(api, mockScanner, await ballotImages.completeHmpb());

    const interpretation: SheetInterpretation = { type: 'ValidSheet' };
    const deferredEject = deferred<Result<void, ScannerError>>();
    mockScanner.client.ejectDocument.mockResolvedValueOnce(
      deferredEject.promise
    );
    await waitForStatus(api, {
      state: 'accepting',
      interpretation,
    });

    deferredEject.resolve(err({ code: 'disconnected' }));
    await waitForStatus(api, { state: 'disconnected' });
  });
});

test('scanner disconnected after accepting', async () => {
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

    expect(mockScanner.client.ejectDocument).toHaveBeenCalledWith('toRear');
    mockScanner.setScannerStatus(mockStatus.idleScanningDisabled);
    clock.increment(delays.DELAY_SCANNER_STATUS_POLLING_INTERVAL);
    await waitForStatus(api, {
      state: 'accepted',
      interpretation,
      ballotsCounted: 1,
    });

    simulateDisconnect(mockScanner);
    await waitForStatus(api, {
      state: 'disconnected',
      ballotsCounted: 1,
    });

    simulateReconnect(mockScanner, mockStatus.idleScanningDisabled);
    clock.increment(delays.DELAY_RECONNECT);
    await waitForStatus(api, {
      state: 'no_paper',
      ballotsCounted: 1,
    });
  });
});

test('scanner disconnected while rejecting', async () => {
  await withApp(async ({ api, mockScanner, mockUsbDrive, mockAuth, clock }) => {
    await configureApp(api, mockAuth, mockUsbDrive);

    clock.increment(delays.DELAY_SCANNING_ENABLED_POLLING_INTERVAL);
    await waitForStatus(api, { state: 'no_paper' });

    simulateScan(api, mockScanner, await ballotImages.wrongElectionBmd());

    const interpretation: SheetInterpretation = {
      type: 'InvalidSheet',
      reason: 'invalid_ballot_hash',
    };
    await waitForStatus(api, { state: 'rejecting', interpretation });

    simulateDisconnect(mockScanner);
    await waitForStatus(api, { state: 'disconnected' });

    simulateReconnect(mockScanner, mockStatus.documentInRear);
    clock.increment(delays.DELAY_RECONNECT);
    await waitForStatus(api, {
      state: 'rejecting',
      error: 'paper_in_back_after_reconnect',
    });
  });
});

// It's unlikely to actually disconnect during this exact moment, but it's
// useful to test this error handling path for coverage
test('scanner disconnected while rejecting - ejectDocument fails', async () => {
  await withApp(async ({ api, mockScanner, mockUsbDrive, mockAuth, clock }) => {
    await configureApp(api, mockAuth, mockUsbDrive, {
      electionPackage:
        electionGridLayoutNewHampshireTestBallotFixtures.electionJson.toElectionPackage(),
    });

    clock.increment(delays.DELAY_SCANNING_ENABLED_POLLING_INTERVAL);
    await waitForStatus(api, { state: 'no_paper' });

    mockScanner.client.ejectDocument.mockResolvedValueOnce(
      err({ code: 'disconnected' })
    );

    simulateScan(api, mockScanner, await ballotImages.wrongElectionBmd());

    await waitForStatus(api, { state: 'disconnected' });
  });
});

test('scanner disconnected while returning', async () => {
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

    api.returnBallot();
    expectStatus(api, { state: 'returning', interpretation });

    simulateDisconnect(mockScanner);
    await waitForStatus(api, { state: 'disconnected' });

    simulateReconnect(mockScanner, mockStatus.documentInRear);
    clock.increment(delays.DELAY_RECONNECT);
    await waitForStatus(api, {
      state: 'rejecting',
      error: 'paper_in_back_after_reconnect',
    });
  });
});

test('scanner disconnected after rejecting', async () => {
  await withApp(async ({ api, mockScanner, mockUsbDrive, mockAuth, clock }) => {
    await configureApp(api, mockAuth, mockUsbDrive);

    clock.increment(delays.DELAY_SCANNING_ENABLED_POLLING_INTERVAL);
    await waitForStatus(api, { state: 'no_paper' });

    simulateScan(api, mockScanner, await ballotImages.wrongElectionBmd());

    const interpretation: SheetInterpretation = {
      type: 'InvalidSheet',
      reason: 'invalid_ballot_hash',
    };
    await waitForStatus(api, { state: 'rejecting', interpretation });

    mockScanner.setScannerStatus(mockStatus.documentInFront);
    clock.increment(delays.DELAY_SCANNER_STATUS_POLLING_INTERVAL);

    await waitForStatus(api, { state: 'rejected', interpretation });

    simulateDisconnect(mockScanner);
    await waitForStatus(api, { state: 'disconnected' });

    simulateReconnect(mockScanner, mockStatus.documentInFront);
    clock.increment(delays.DELAY_RECONNECT);
    await waitForStatus(api, {
      state: 'rejected',
      error: 'paper_in_front_after_reconnect',
    });
  });
});

test('scanner error on reconnect', async () => {
  await withApp(async ({ api, mockScanner, mockUsbDrive, mockAuth, clock }) => {
    await configureApp(api, mockAuth, mockUsbDrive);

    clock.increment(delays.DELAY_SCANNING_ENABLED_POLLING_INTERVAL);
    await waitForStatus(api, { state: 'no_paper' });

    simulateDisconnect(mockScanner);
    await waitForStatus(api, { state: 'disconnected' });

    // Sometimes when the scanner is disconnected while scanning, it will not
    // reconnect and require a restart
    mockScanner.client.connect.mockResolvedValue(
      err({
        code: 'other',
        message: 'failed to receive: timed out waiting on channel',
      })
    );
    clock.increment(delays.DELAY_RECONNECT);
    await waitForStatus(api, { state: 'unrecoverable_error' });
  });
});
