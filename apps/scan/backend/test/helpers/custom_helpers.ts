import { Buffer } from 'node:buffer';
import { type InsertedSmartCardAuthApi } from '@vx/libs/auth/inserted-cards';
import { buildMockInsertedSmartCardAuth } from '@vx/libs/auth/test-utils';
import { type Result, ok } from '@vx/libs/basics/result';
import { assert } from '@vx/libs/basics/assert';
import { deferred } from '@vx/libs/basics/async';
import {
  type CustomScanner,
  ErrorCode,
  ImageColorDepthType,
  ImageFileFormat,
  type ImageFromScanner,
  ScanSide,
  mocks,
} from '@vx/libs/custom-scanner/src';
import {
  electionFamousNames2021Fixtures,
  electionGeneralDefinition,
  electionGridLayoutNewHampshireTestBallotFixtures,
  sampleBallotImages,
} from '@vx/libs/fixtures/src';
import * as grout from '@vx/libs/grout/src';
import {
  ImageData,
  RGBA_CHANNEL_COUNT,
  isRgba,
} from '@vx/libs/image-utils/src';
import { Logger, mockBaseLogger } from '@vx/libs/logging/src';
import { type SheetOf, mapSheet } from '@vx/libs/types/elections';
import { Application } from 'express';
import { Server } from 'node:http';
import { AddressInfo } from 'node:net';
import tmp from 'tmp';
import { createMockUsbDrive, type MockUsbDrive } from '@vx/libs/usb-drive/src';
import {
  type MemoryPrinterHandler,
  createMockPrinterHandler,
} from '@vx/libs/printing/src/printer';
import {
  type MemoryFujitsuPrinterHandler,
  createMockFujitsuPrinterHandler,
} from '@vx/libs/fujitsu-thermal-printer/src';
import {
  BooleanEnvironmentVariableName,
  isFeatureFlagEnabled,
} from '@vx/libs/utils/src';
import { SimulatedClock } from 'xstate/lib/SimulatedClock';
import {
  DEFAULT_FAMOUS_NAMES_BALLOT_STYLE_ID,
  DEFAULT_FAMOUS_NAMES_PRECINCT_ID,
  DEFAULT_FAMOUS_NAMES_VOTES,
  renderBmdBallotFixture,
} from '@vx/libs/bmd-ballot-fixtures/src';
import { type Api, buildApp } from '../../app/app';
import {
  createPrecinctScannerStateMachine,
  delays,
} from '../../scanners/custom/state_machine';
import { type Workspace, createWorkspace } from '../../workspace/workspace';
import {
  buildMockLogger,
  expectStatus,
  pdfToImageSheet,
  waitForContinuousExportToUsbDrive,
  waitForStatus,
} from './shared_helpers';
import { Store } from '../../store/store';
import {
  wrapFujitsuThermalPrinter,
  wrapLegacyPrinter,
} from '../../printing/printer';

export async function withApp(
  fn: (context: {
    apiClient: grout.Client<Api>;
    app: Application;
    mockAuth: InsertedSmartCardAuthApi;
    mockScanner: jest.Mocked<CustomScanner>;
    workspace: Workspace;
    mockUsbDrive: MockUsbDrive;
    mockPrinterHandler: MemoryPrinterHandler;
    mockFujitsuPrinterHandler: MemoryFujitsuPrinterHandler;
    logger: Logger;
    server: Server;
    clock: SimulatedClock;
  }) => Promise<void>
): Promise<void> {
  const mockAuth = buildMockInsertedSmartCardAuth();
  const workspace = createWorkspace(tmp.dirSync().name, mockBaseLogger());
  const logger = buildMockLogger(mockAuth, workspace);
  const mockScanner = mocks.mockCustomScanner();
  const mockUsbDrive = createMockUsbDrive();
  mockUsbDrive.usbDrive.sync.expectOptionalRepeatedCallsWith().resolves(); // Called by continuous export
  const mockPrinterHandler = createMockPrinterHandler();
  const mockFujitsuPrinterHandler = createMockFujitsuPrinterHandler();
  const deferredConnect = deferred<void>();
  async function createCustomClient(): Promise<
    Result<CustomScanner, ErrorCode>
  > {
    const connectResult = await mockScanner.connect();
    if (connectResult.isErr()) {
      return connectResult;
    }
    await deferredConnect.promise;
    return ok(mockScanner);
  }
  const clock = new SimulatedClock();
  const precinctScannerMachine = createPrecinctScannerStateMachine({
    auth: mockAuth,
    createCustomClient,
    workspace,
    logger,
    usbDrive: mockUsbDrive.usbDrive,
    clock,
  });
  const printer = isFeatureFlagEnabled(
    BooleanEnvironmentVariableName.USE_BROTHER_PRINTER
  )
    ? wrapLegacyPrinter(mockPrinterHandler.printer)
    : wrapFujitsuThermalPrinter(mockFujitsuPrinterHandler.printer);
  const app = buildApp({
    auth: mockAuth,
    machine: precinctScannerMachine,
    workspace,
    usbDrive: mockUsbDrive.usbDrive,
    printer,
    logger,
  });

  const server = app.listen();
  const { port } = server.address() as AddressInfo;
  const baseUrl = `http://localhost:${port}/api`;

  const apiClient = grout.createClient<Api>({ baseUrl });

  await expectStatus(apiClient, { state: 'connecting' });
  deferredConnect.resolve();
  await waitForStatus(apiClient, { state: 'no_paper' });

  try {
    await fn({
      apiClient,
      app,
      mockAuth,
      mockScanner,
      workspace,
      mockUsbDrive,
      mockPrinterHandler,
      mockFujitsuPrinterHandler,
      logger,
      server,
      clock,
    });
    mockUsbDrive.assertComplete();
  } finally {
    if (workspace.store.getIsContinuousExportEnabled()) {
      await waitForContinuousExportToUsbDrive(workspace.store);
    }
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
    precinctScannerMachine.stop();
    workspace.reset();
  }
}

function customSheetOfImagesFromScannerFromBallotImageData(
  ballotImageData: SheetOf<ImageData>
): SheetOf<ImageFromScanner> {
  return mapSheet(ballotImageData, (imageData, side): ImageFromScanner => {
    assert(isRgba(imageData), 'Expected image data to be in RGBA format');
    const imageDepth = ImageColorDepthType.Grey8bpp;
    const imageBuffer = Buffer.alloc(imageData.width * imageData.height);

    for (
      let rgbaOffset = 0, grayOffset = 0;
      rgbaOffset < imageData.data.length;
      rgbaOffset += RGBA_CHANNEL_COUNT, grayOffset += 1
    ) {
      imageBuffer[grayOffset] = imageData.data[rgbaOffset];
    }

    return {
      scanSide: side === 'front' ? ScanSide.A : ScanSide.B,
      imageBuffer,
      imageWidth: imageData.width,
      imageHeight: imageData.height,
      imageFormat: ImageFileFormat.Jpeg,
      imageDepth,
      imageResolution: Math.round(imageData.width / 8.5),
    };
  });
}

export const ballotImages = {
  completeHmpb: async () =>
    customSheetOfImagesFromScannerFromBallotImageData([
      await electionGridLayoutNewHampshireTestBallotFixtures.scanMarkedFront.asImageData(),
      await electionGridLayoutNewHampshireTestBallotFixtures.scanMarkedBack.asImageData(),
    ]),
  completeBmd: async () =>
    customSheetOfImagesFromScannerFromBallotImageData(
      await pdfToImageSheet(
        await renderBmdBallotFixture({
          electionDefinition:
            electionFamousNames2021Fixtures.electionDefinition,
          ballotStyleId: DEFAULT_FAMOUS_NAMES_BALLOT_STYLE_ID,
          precinctId: DEFAULT_FAMOUS_NAMES_PRECINCT_ID,
          votes: DEFAULT_FAMOUS_NAMES_VOTES,
        })
      )
    ),
  overvoteHmpb: async () =>
    customSheetOfImagesFromScannerFromBallotImageData([
      await electionGridLayoutNewHampshireTestBallotFixtures.scanMarkedOvervoteFront.asImageData(),
      await electionGridLayoutNewHampshireTestBallotFixtures.scanMarkedOvervoteBack.asImageData(),
    ]),
  unmarkedHmpb: async () =>
    customSheetOfImagesFromScannerFromBallotImageData([
      await electionGridLayoutNewHampshireTestBallotFixtures.scanUnmarkedFront.asImageData(),
      await electionGridLayoutNewHampshireTestBallotFixtures.scanUnmarkedBack.asImageData(),
    ]),
  wrongElection: async () =>
    customSheetOfImagesFromScannerFromBallotImageData(
      await pdfToImageSheet(
        await renderBmdBallotFixture({
          electionDefinition: electionGeneralDefinition,
        })
      )
    ),
  blankSheet: async () =>
    customSheetOfImagesFromScannerFromBallotImageData([
      await sampleBallotImages.blankPage.asImageData(),
      await sampleBallotImages.blankPage.asImageData(),
    ]),
} as const;

/**
 * To avoid race conditions within the state machine, its important that the
 * mock scanner immediately transition from READY_TO_SCAN to READY_TO_EJECT once
 * the scan command completes (simulating how the real scanner works). This
 * helper function implements that pattern.
 */
export function simulateScan(
  mockScanner: jest.Mocked<CustomScanner>,
  ballotImage: SheetOf<ImageFromScanner>,
  clock: SimulatedClock
): void {
  let didScan = false;
  mockScanner.getStatus.mockImplementation(async () => {
    if (!didScan) {
      return Promise.resolve(ok(mocks.MOCK_READY_TO_SCAN));
    }
    return Promise.resolve(ok(mocks.MOCK_READY_TO_EJECT));
  });
  mockScanner.scan.mockImplementationOnce(() => {
    didScan = true;
    return Promise.resolve(ok(ballotImage));
  });
  clock.increment(delays.DELAY_PAPER_STATUS_POLLING_INTERVAL);
}

export async function scanBallot(
  mockScanner: jest.Mocked<CustomScanner>,
  apiClient: grout.Client<Api>,
  store: Store,
  initialBallotsCounted: number,
  options: { waitForContinuousExportToUsbDrive?: boolean } = {}
): Promise<void> {
  mockScanner.getStatus.mockResolvedValue(ok(mocks.MOCK_READY_TO_SCAN));
  mockScanner.scan.mockImplementation(async () => {
    mockScanner.getStatus.mockResolvedValue(ok(mocks.MOCK_READY_TO_EJECT));
    return ok(await ballotImages.completeBmd());
  });
  await waitForStatus(apiClient, {
    state: 'accepting',
    ballotsCounted: initialBallotsCounted,
    interpretation: { type: 'ValidSheet' },
  });

  await apiClient.acceptBallot();
  mockScanner.getStatus.mockResolvedValue(ok(mocks.MOCK_NO_PAPER));
  await waitForStatus(apiClient, {
    state: 'no_paper',
    ballotsCounted: initialBallotsCounted + 1,
  });

  if (options.waitForContinuousExportToUsbDrive ?? true) {
    await waitForContinuousExportToUsbDrive(store);
  }
}
