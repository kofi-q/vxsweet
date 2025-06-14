jest.mock('@vx/libs/utils/src', (): typeof import('@vx/libs/utils/src') => {
  return {
    ...jest.requireActual('@vx/libs/utils/src'),
    isFeatureFlagEnabled: (flag) => mockFeatureFlagger.isEnabled(flag),
  };
});

import { ok } from '@vx/libs/basics/result';
import { mocks } from '@vx/libs/custom-scanner/src';
import * as electionGridLayoutNewHampshireTestBallotFixtures from '@vx/libs/fixtures/src/data/electionGridLayoutNewHampshireTestBallot';
import { DEFAULT_SYSTEM_SETTINGS } from '@vx/libs/types/elections';
import { type SheetInterpretation } from '@vx/libs/types/scanning';
import {
  getFeatureFlagMock,
  BooleanEnvironmentVariableName,
} from '@vx/libs/utils/src';
import { configureApp, waitForStatus } from '../../test/helpers/shared_helpers';
import {
  ballotImages,
  simulateScan,
  withApp,
} from '../../test/helpers/custom_helpers';
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

test('shoeshine mode scans the same ballot repeatedly', async () => {
  await withApp(async ({ api, mockScanner, mockUsbDrive, mockAuth, clock }) => {
    await configureApp(api, mockAuth, mockUsbDrive, {
      electionPackage:
        electionGridLayoutNewHampshireTestBallotFixtures.electionJson.toElectionPackage(
          {
            ...DEFAULT_SYSTEM_SETTINGS,
            precinctScanEnableShoeshineMode: true,
          }
        ),
    });

    mockScanner.getStatus.mockResolvedValue(ok(mocks.MOCK_READY_TO_SCAN));

    const interpretation: SheetInterpretation = {
      type: 'ValidSheet',
    };

    simulateScan(mockScanner, await ballotImages.completeHmpb(), clock);
    const ballotsCounted = 1;
    await waitForStatus(api, {
      state: 'accepted',
      interpretation,
      ballotsCounted,
    });
    clock.increment(delays.DELAY_ACCEPTED_READY_FOR_NEXT_BALLOT);
    await waitForStatus(api, {
      state: 'returning_to_rescan',
      ballotsCounted,
    });

    mockScanner.getStatus.mockResolvedValue(ok(mocks.MOCK_READY_TO_SCAN));
    simulateScan(mockScanner, await ballotImages.completeHmpb(), clock);
    await waitForStatus(api, {
      state: 'accepted',
      interpretation,
      ballotsCounted: 2,
    });
  });
});
