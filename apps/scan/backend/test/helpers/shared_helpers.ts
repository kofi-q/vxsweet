import { type InsertedSmartCardAuthApi } from '@vx/libs/auth/inserted-cards';
import { iter } from '@vx/libs/basics/iterators';
import { ok } from '@vx/libs/basics/result';
import { mockElectionPackageFileTree } from '@vx/libs/backend/election_package';
import * as electionFamousNames2021Fixtures from '@vx/libs/fixtures/src/data/electionFamousNames2021';
import {
  mockElectionManagerUser,
  mockSessionExpiresAt,
  mockOf,
} from '@vx/libs/test-utils/src';
import {
  type ElectionPackage,
  type PrecinctId,
  type SheetOf,
  asSheet,
  constructElectionKey,
} from '@vx/libs/types/elections';
import { type PrecinctScannerState } from '@vx/libs/types/scanning';
import {
  ALL_PRECINCTS_SELECTION,
  singlePrecinctSelectionFor,
} from '@vx/libs/utils/src';
import waitForExpect from 'wait-for-expect';
import { type MockUsbDrive } from '@vx/libs/usb-drive/src';
import { Logger, mockLogger } from '@vx/libs/logging/src';
import { LogSource } from '@vx/libs/logging/src/base_types';
import { pdfToImages, ImageData } from '@vx/libs/image-utils/src';
import { Buffer } from 'node:buffer';
import { type Api } from '../../app/app';
import {
  type PrecinctScannerStateMachine,
  type PrecinctScannerStatus,
} from '../../types/types';
import { Store } from '../../store/store';
import { getUserRole } from '../../auth/auth';
import { type Workspace } from '../../workspace/workspace';

export function expectStatus(
  api: Api,
  expectedStatus: {
    state: PrecinctScannerState;
  } & Partial<PrecinctScannerStatus>
): void {
  const status = api.getScannerStatus();
  expect(status).toEqual({
    ballotsCounted: 0,
    error: undefined,
    interpretation: undefined,
    ...expectedStatus,
  });
}

export async function waitForStatus(
  api: Api,
  status: {
    state: PrecinctScannerState;
  } & Partial<PrecinctScannerStatus>
): Promise<void> {
  await waitForExpect(() => {
    expectStatus(api, status);
  }, 2_000);
}

/**
 * configureApp is a testing convenience function that handles some common configuration of the VxScan app.
 * @param api - a VxScan API client
 * @param mockAuth - a mock InsertedSmartCardAuthApi
 * @param mockUsbDrive - a mock USB drive
 * @param options - an object containing optional arguments
 */
export async function configureApp(
  api: Api,
  mockAuth: InsertedSmartCardAuthApi,
  mockUsbDrive: MockUsbDrive,
  {
    electionPackage = electionFamousNames2021Fixtures.electionJson.toElectionPackage(),
    precinctId,
    testMode = false,
    openPolls = true,
  }: {
    electionPackage?: ElectionPackage;
    precinctId?: PrecinctId;
    testMode?: boolean;
    openPolls?: boolean;
  } = {}
): Promise<void> {
  mockOf(mockAuth.getAuthStatus).mockImplementation(() =>
    Promise.resolve({
      status: 'logged_in',
      user: mockElectionManagerUser({
        electionKey: constructElectionKey(
          electionPackage.electionDefinition.election
        ),
      }),
      sessionExpiresAt: mockSessionExpiresAt(),
    })
  );

  mockUsbDrive.insertUsbDrive(
    await mockElectionPackageFileTree(electionPackage)
  );

  expect(await api.configureFromElectionPackageOnUsbDrive()).toEqual(ok());

  api.setPrecinctSelection({
    precinctSelection: precinctId
      ? singlePrecinctSelectionFor(precinctId)
      : ALL_PRECINCTS_SELECTION,
  });
  await api.setTestMode({ isTestMode: testMode });
  if (openPolls) {
    api.openPolls().unsafeUnwrap();
  }

  mockOf(mockAuth.getAuthStatus).mockImplementation(() =>
    Promise.resolve({
      status: 'logged_out',
      reason: 'no_card',
    })
  );
}

/**
 * Continuous export to USB drive happens in the background as ballots are scanned. Ending a test
 * before continuous export finishes can result in errors due to directories getting cleaned up
 * while they're still being read from / written to.
 */
export async function waitForContinuousExportToUsbDrive(
  store: Store
): Promise<void> {
  await waitForExpect(
    () => expect(store.getPendingContinuousExportOperations()).toEqual([]),
    10000,
    250
  );
}

export function buildMockLogger(
  auth: InsertedSmartCardAuthApi,
  workspace: Workspace
): Logger {
  return mockLogger(LogSource.VxScanBackend, () =>
    getUserRole(auth, workspace)
  );
}

export function createPrecinctScannerStateMachineMock(): jest.Mocked<PrecinctScannerStateMachine> {
  return {
    status: jest.fn(),
    accept: jest.fn(),
    return: jest.fn(),
    stop: jest.fn(),
    beginDoubleFeedCalibration: jest.fn(),
    endDoubleFeedCalibration: jest.fn(),
    beginScannerDiagnostic: jest.fn(),
    endScannerDiagnostic: jest.fn(),
  };
}

export async function pdfToImageSheet(
  pdf: Buffer
): Promise<SheetOf<ImageData>> {
  return asSheet(
    await iter(pdfToImages(pdf, { scale: 200 / 72 }))
      .map(({ page }) => page)
      .toArray()
  );
}
