import * as electionFamousNames2021Fixtures from '@vx/libs/fixtures/src/data/electionFamousNames2021';
import * as electionGridLayoutNewHampshireTestBallotFixtures from '@vx/libs/fixtures/src/data/electionGridLayoutNewHampshireTestBallot';
import { ImageData } from '@vx/libs/image-utils/src';
import * as tmp from 'tmp';
import { type InsertedSmartCardAuthApi } from '@vx/libs/auth/inserted-cards';
import { buildMockInsertedSmartCardAuth } from '@vx/libs/auth/test-utils';
import * as sampleBallotImages from '@vx/libs/fixtures/src/data/sample-ballot-images';
import {
  type Listener,
  type ScannerClient,
  type ScannerError,
  type ScannerEvent,
  type ScannerStatus,
} from '@vx/libs/pdi-scanner/src/ts';
import { type MockUsbDrive, createMockUsbDrive } from '@vx/libs/usb-drive/src';
import {
  type MemoryPrinterHandler,
  createMockPrinterHandler,
} from '@vx/libs/printing/src/printer';
import {
  type MemoryFujitsuPrinterHandler,
  createMockFujitsuPrinterHandler,
} from '@vx/libs/fujitsu-thermal-printer/src';
import { Logger, mockBaseLogger } from '@vx/libs/logging/src';
import { type Result, ok } from '@vx/libs/basics/result';
import { deferred } from '@vx/libs/basics/async';
import {
  BooleanEnvironmentVariableName,
  isFeatureFlagEnabled,
} from '@vx/libs/utils/src';
import { SimulatedClock } from 'xstate/lib/SimulatedClock';
import * as electionGeneral from '@vx/libs/fixtures/src/data/electionGeneral/election.json';
import { type SheetOf } from '@vx/libs/types/elections';
import {
  DEFAULT_FAMOUS_NAMES_BALLOT_STYLE_ID,
  DEFAULT_FAMOUS_NAMES_PRECINCT_ID,
  DEFAULT_FAMOUS_NAMES_VOTES,
  renderBmdBallotFixture,
} from '@vx/libs/bmd-ballot-fixtures/src';
import {
  createPrecinctScannerStateMachine,
  delays,
} from '../../scanners/pdi/state_machine';
import { type Workspace, createWorkspace } from '../../workspace/workspace';
import { type Api, buildApi } from '../../app/app';
import {
  wrapFujitsuThermalPrinter,
  wrapLegacyPrinter,
} from '../../printing/printer';
import {
  buildMockLogger,
  expectStatus,
  pdfToImageSheet,
  waitForContinuousExportToUsbDrive,
  waitForStatus,
} from './shared_helpers';
import { Store } from '../../store/store';

export interface MockPdiScannerClient {
  emitEvent: (event: ScannerEvent) => void;
  setScannerStatus: (status: ScannerStatus) => void;
  client: jest.Mocked<ScannerClient>;
}

const baseStatus: ScannerStatus = {
  rearLeftSensorCovered: false,
  rearRightSensorCovered: false,
  branderPositionSensorCovered: false,
  hiSpeedMode: true,
  coverOpen: false,
  scannerEnabled: false,
  frontLeftSensorCovered: false,
  frontM1SensorCovered: false,
  frontM2SensorCovered: false,
  frontM3SensorCovered: false,
  frontM4SensorCovered: false,
  frontM5SensorCovered: false,
  frontRightSensorCovered: false,
  scannerReady: true,
  xmtAborted: false,
  documentJam: false,
  scanArrayPixelError: false,
  inDiagnosticMode: false,
  documentInScanner: false,
  calibrationOfUnitNeeded: false,
};

export const mockStatus = {
  idleScanningDisabled: baseStatus,
  idleScanningEnabled: {
    ...baseStatus,
    scannerEnabled: true,
  },
  documentInRear: {
    ...baseStatus,
    rearLeftSensorCovered: true,
    rearRightSensorCovered: true,
    documentInScanner: true,
  },
  documentInFront: {
    ...baseStatus,
    frontLeftSensorCovered: true,
    frontM1SensorCovered: true,
    frontM2SensorCovered: true,
    frontM3SensorCovered: true,
    frontM4SensorCovered: true,
    documentInScanner: true,
  },
  jammed: {
    ...baseStatus,
    rearLeftSensorCovered: true,
    frontLeftSensorCovered: true,
    frontM1SensorCovered: true,
    documentInScanner: true,
    documentJam: true,
  },
  coverOpen: {
    ...baseStatus,
    coverOpen: true,
  },
  jammedCoverOpen: {
    ...baseStatus,
    rearLeftSensorCovered: true,
    frontLeftSensorCovered: true,
    frontM1SensorCovered: true,
    documentInScanner: true,
    documentJam: true,
    coverOpen: true,
  },
  documentInFrontAndRear: {
    ...baseStatus,
    frontLeftSensorCovered: true,
    frontM1SensorCovered: true,
    frontM2SensorCovered: true,
    frontM3SensorCovered: true,
    frontM4SensorCovered: true,
    rearLeftSensorCovered: true,
    rearRightSensorCovered: true,
    documentInScanner: true,
  },
} satisfies Record<string, ScannerStatus>;

export function createMockPdiScannerClient(): MockPdiScannerClient {
  const getScannerStatusMock = jest.fn();
  function setScannerStatus(status: ScannerStatus) {
    getScannerStatusMock.mockResolvedValue(ok(status));
  }
  setScannerStatus(mockStatus.idleScanningDisabled);

  const listeners = new Set<Listener>();

  return {
    emitEvent: (event: ScannerEvent) => {
      // Snapshot the current set of listeners so that new listeners can be
      // added/removed as a side effect of calling a listener without also
      // receiving this event.
      for (const listener of [...listeners]) {
        listener(event);
      }
    },
    setScannerStatus,
    client: {
      addListener: jest.fn((listener) => {
        listeners.add(listener);
        return listener;
      }),
      removeListener: jest.fn((listener) => {
        listeners.delete(listener);
      }),
      connect: jest.fn(),
      getScannerStatus: getScannerStatusMock,
      enableScanning: jest.fn().mockResolvedValue(ok()),
      disableScanning: jest.fn().mockResolvedValue(ok()),
      ejectDocument: jest.fn().mockResolvedValue(ok()),
      calibrateDoubleFeedDetection: jest.fn().mockResolvedValue(ok()),
      getDoubleFeedDetectionCalibrationConfig: jest
        .fn()
        .mockRejectedValue(new Error('Not used')),
      disconnect: jest.fn().mockResolvedValue(ok()),
      exit: jest.fn().mockResolvedValue(ok()),
    },
  };
}

export function simulateScan(
  api: Api,
  mockScanner: MockPdiScannerClient,
  images: SheetOf<ImageData>,
  ballotsCounted = 0
): void {
  mockScanner.emitEvent({ event: 'scanStart' });
  expectStatus(api, { state: 'scanning', ballotsCounted });
  mockScanner.setScannerStatus(mockStatus.documentInRear);
  mockScanner.emitEvent({
    event: 'scanComplete',
    images,
  });
}

export async function withApp(
  fn: (context: {
    api: Api;
    mockAuth: InsertedSmartCardAuthApi;
    mockScanner: MockPdiScannerClient;
    workspace: Workspace;
    mockUsbDrive: MockUsbDrive;
    mockPrinterHandler: MemoryPrinterHandler;
    mockFujitsuPrinterHandler: MemoryFujitsuPrinterHandler;
    logger: Logger;
    clock: SimulatedClock;
  }) => void | Promise<void>
): Promise<void> {
  const mockAuth = buildMockInsertedSmartCardAuth();
  const workspace = createWorkspace(tmp.dirSync().name, mockBaseLogger());
  const logger = buildMockLogger(mockAuth, workspace);
  const mockUsbDrive = createMockUsbDrive();
  mockUsbDrive.usbDrive.sync.expectOptionalRepeatedCallsWith().resolves(); // Called by continuous export
  const mockPrinterHandler = createMockPrinterHandler();
  const mockFujitsuPrinterHandler = createMockFujitsuPrinterHandler();
  const printer = isFeatureFlagEnabled(
    BooleanEnvironmentVariableName.USE_BROTHER_PRINTER
  )
    ? wrapLegacyPrinter(mockPrinterHandler.printer)
    : wrapFujitsuThermalPrinter(mockFujitsuPrinterHandler.printer);

  const mockScanner = createMockPdiScannerClient();
  const deferredConnect = deferred<Result<void, ScannerError>>();
  mockScanner.client.connect.mockResolvedValueOnce(deferredConnect.promise);
  const clock = new SimulatedClock();
  const precinctScannerMachine = createPrecinctScannerStateMachine({
    auth: mockAuth,
    createScannerClient: () => mockScanner.client,
    workspace,
    logger,
    usbDrive: mockUsbDrive.usbDrive,
    clock,
  });

  const api = buildApi({
    auth: mockAuth,
    machine: precinctScannerMachine,
    workspace,
    usbDrive: mockUsbDrive.usbDrive,
    printer,
    logger,
  });

  expectStatus(api, { state: 'connecting' });
  deferredConnect.resolve(ok());
  // State machine should be paused since app is not configured
  await waitForStatus(api, { state: 'paused' });

  try {
    await fn({
      api,
      mockAuth,
      mockScanner,
      workspace,
      mockUsbDrive,
      mockPrinterHandler,
      mockFujitsuPrinterHandler,
      logger,
      clock,
    });
    mockUsbDrive.assertComplete();
  } finally {
    await waitForContinuousExportToUsbDrive(workspace.store);
    precinctScannerMachine.stop();
    workspace.reset();
  }
}

export const ballotImages = {
  completeHmpb: async () => [
    await electionGridLayoutNewHampshireTestBallotFixtures.scanMarkedFront.asImageData(),
    await electionGridLayoutNewHampshireTestBallotFixtures.scanMarkedBack.asImageData(),
  ],
  completeBmd: async () =>
    pdfToImageSheet(
      await renderBmdBallotFixture({
        electionDefinition:
          electionFamousNames2021Fixtures.electionJson.toElectionDefinition(),
        ballotStyleId: DEFAULT_FAMOUS_NAMES_BALLOT_STYLE_ID,
        precinctId: DEFAULT_FAMOUS_NAMES_PRECINCT_ID,
        votes: DEFAULT_FAMOUS_NAMES_VOTES,
      })
    ),
  overvoteHmpb: async () => [
    await electionGridLayoutNewHampshireTestBallotFixtures.scanMarkedOvervoteFront.asImageData(),
    await electionGridLayoutNewHampshireTestBallotFixtures.scanMarkedOvervoteBack.asImageData(),
  ],
  wrongElectionBmd: async () =>
    pdfToImageSheet(
      await renderBmdBallotFixture({
        electionDefinition: electionGeneral.toElectionDefinition(),
      })
    ),
  blankSheet: async () => [
    await sampleBallotImages.blankPage.asImageData(),
    await sampleBallotImages.blankPage.asImageData(),
  ],
} satisfies Record<string, () => Promise<SheetOf<ImageData>>>;

export async function scanBallot(
  mockScanner: MockPdiScannerClient,
  clock: SimulatedClock,
  api: Api,
  store: Store,
  initialBallotsCounted: number,
  options: { waitForContinuousExportToUsbDrive?: boolean } = {}
): Promise<void> {
  clock.increment(delays.DELAY_SCANNING_ENABLED_POLLING_INTERVAL);
  await waitForStatus(api, {
    state: 'no_paper',
    ballotsCounted: initialBallotsCounted,
  });
  simulateScan(
    api,
    mockScanner,
    await ballotImages.completeBmd(),
    initialBallotsCounted
  );
  await waitForStatus(api, {
    state: 'accepting',
    ballotsCounted: initialBallotsCounted,
    interpretation: { type: 'ValidSheet' },
  });
  expect(mockScanner.client.ejectDocument).toHaveBeenCalledWith('toRear');
  mockScanner.setScannerStatus(mockStatus.idleScanningDisabled);

  clock.increment(delays.DELAY_SCANNER_STATUS_POLLING_INTERVAL);
  await waitForStatus(api, {
    state: 'accepted',
    interpretation: { type: 'ValidSheet' },
    ballotsCounted: initialBallotsCounted + 1,
  });

  clock.increment(delays.DELAY_ACCEPTED_READY_FOR_NEXT_BALLOT);
  await waitForStatus(api, {
    state: 'no_paper',
    ballotsCounted: initialBallotsCounted + 1,
  });

  if (options.waitForContinuousExportToUsbDrive ?? true) {
    await waitForContinuousExportToUsbDrive(store);
  }
}
