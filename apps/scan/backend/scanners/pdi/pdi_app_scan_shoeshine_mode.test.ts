jest.mock('@vx/libs/utils/src', (): typeof import('@vx/libs/utils/src') => {
  return {
    ...jest.requireActual('@vx/libs/utils/src'),
    isFeatureFlagEnabled: (flag) => mockFeatureFlagger.isEnabled(flag),
  };
});

import * as electionGridLayoutNewHampshireTestBallotFixtures from '@vx/libs/fixtures/src/data/electionGridLayoutNewHampshireTestBallot';
import {
  getFeatureFlagMock,
  BooleanEnvironmentVariableName,
} from '@vx/libs/utils/src';
import { DEFAULT_SYSTEM_SETTINGS } from '@vx/libs/types/elections';
import { type SheetInterpretation } from '@vx/libs/types/scanning';
import {
  ballotImages,
  simulateScan,
  withApp,
} from '../../test/helpers/pdi_helpers';
import { configureApp, waitForStatus } from '../../test/helpers/shared_helpers';
import { delays } from './state_machine';

jest.setTimeout(20_000);

const mockFeatureFlagger = getFeatureFlagMock();

beforeEach(() => {
  mockFeatureFlagger.enableFeatureFlag(
    BooleanEnvironmentVariableName.SKIP_ELECTION_PACKAGE_AUTHENTICATION
  );
});

const electionPackage =
  electionGridLayoutNewHampshireTestBallotFixtures.electionJson.toElectionPackage(
    {
      ...DEFAULT_SYSTEM_SETTINGS,
      precinctScanEnableShoeshineMode: true,
    }
  );

test('shoeshine mode scans the same ballot repeatedly', async () => {
  await withApp(async ({ api, mockScanner, mockUsbDrive, mockAuth, clock }) => {
    await configureApp(api, mockAuth, mockUsbDrive, {
      electionPackage,
    });

    clock.increment(delays.DELAY_SCANNING_ENABLED_POLLING_INTERVAL);
    await waitForStatus(api, { state: 'no_paper' });
    expect(mockScanner.client.enableScanning).toHaveBeenCalled();

    simulateScan(api, mockScanner, await ballotImages.completeHmpb());

    const interpretation: SheetInterpretation = { type: 'ValidSheet' };
    let ballotsCounted = 1;
    await waitForStatus(api, {
      state: 'accepted',
      interpretation,
      ballotsCounted,
    });
    expect(mockScanner.client.ejectDocument).not.toHaveBeenCalled();

    clock.increment(delays.DELAY_ACCEPTED_READY_FOR_NEXT_BALLOT);
    await waitForStatus(api, {
      state: 'accepted',
      ballotsCounted: 1,
    });
    expect(mockScanner.client.ejectDocument).toHaveBeenCalledWith(
      'toFrontAndRescan'
    );

    simulateScan(
      api,
      mockScanner,
      await ballotImages.completeHmpb(),
      ballotsCounted
    );
    ballotsCounted = 2;
    await waitForStatus(api, {
      state: 'accepted',
      interpretation,
      ballotsCounted,
    });
  });
});

test('handles error on eject for rescan', async () => {
  await withApp(async ({ api, mockScanner, mockUsbDrive, mockAuth, clock }) => {
    await configureApp(api, mockAuth, mockUsbDrive, {
      electionPackage,
    });

    clock.increment(delays.DELAY_SCANNING_ENABLED_POLLING_INTERVAL);
    await waitForStatus(api, { state: 'no_paper' });
    expect(mockScanner.client.enableScanning).toHaveBeenCalled();

    simulateScan(api, mockScanner, await ballotImages.completeHmpb());

    const interpretation: SheetInterpretation = { type: 'ValidSheet' };
    const ballotsCounted = 1;
    await waitForStatus(api, {
      state: 'accepted',
      interpretation,
      ballotsCounted,
    });
    expect(mockScanner.client.ejectDocument).not.toHaveBeenCalled();

    mockScanner.client.ejectDocument.mockRejectedValue(
      new Error('eject failed')
    );
    clock.increment(delays.DELAY_ACCEPTED_READY_FOR_NEXT_BALLOT);
    await waitForStatus(api, {
      state: 'unrecoverable_error',
      ballotsCounted: 1,
    });
  });
});
