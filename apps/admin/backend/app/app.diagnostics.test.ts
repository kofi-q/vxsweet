jest.mock(
  '@vx/libs/backend/system_call',
  (): typeof import('@vx/libs/backend/system_call') => ({
    ...jest.requireActual('@vx/libs/backend/system_call'),
    getBatteryInfo: jest.fn(),
  })
);
jest.mock(
  '@vx/libs/backend/diagnostics',
  (): typeof import('@vx/libs/backend/diagnostics') => ({
    ...jest.requireActual('@vx/libs/backend/diagnostics'),
    initializeGetWorkspaceDiskSpaceSummary: jest.fn(),
  })
);

jest.mock('../util/time/get_current_time', () => ({
  getCurrentTime: () => reportPrintedTime.getTime(),
}));

import { LogEventId } from '@vx/libs/logging/src';
import { HP_LASER_PRINTER_CONFIG } from '@vx/libs/printing/src/printer';
import {
  type DiskSpaceSummary,
  initializeGetWorkspaceDiskSpaceSummary,
} from '@vx/libs/backend/diagnostics';
import { getBatteryInfo } from '@vx/libs/backend/system_call';
import { mockOf } from '@vx/libs/test-utils/src';
import { type DiagnosticRecord } from '@vx/libs/types/diagnostics';
import * as electionTwoPartyPrimary from '@vx/libs/fixtures/src/data/electionTwoPartyPrimary/election.json';
import {
  buildTestEnvironment,
  configureMachine,
  mockSystemAdministratorAuth,
} from '../test/app';
import '@vx/libs/image-test-utils/register';
const electionTwoPartyPrimaryDefinition =
  electionTwoPartyPrimary.toElectionDefinition();

jest.setTimeout(60_000);

const MOCK_DISK_SPACE_SUMMARY: DiskSpaceSummary = {
  total: 10 * 1_000_000,
  used: 1 * 1_000_000,
  available: 9 * 1_000_000,
};

beforeEach(() => {
  mockOf(getBatteryInfo).mockResolvedValue({
    level: 0.5,
    discharging: false,
  });
  mockOf(initializeGetWorkspaceDiskSpaceSummary).mockReturnValue(() =>
    Promise.resolve(MOCK_DISK_SPACE_SUMMARY)
  );
});

test('diagnostic records', () => {
  jest.useFakeTimers();
  const { api, logger, auth } = buildTestEnvironment();
  mockSystemAdministratorAuth(auth);

  expect(api.getMostRecentPrinterDiagnostic()).toEqual(null);

  jest.setSystemTime(new Date(1000));
  api.addDiagnosticRecord({
    type: 'test-print',
    outcome: 'fail',
  });
  expect(api.getMostRecentPrinterDiagnostic()).toEqual<DiagnosticRecord>({
    type: 'test-print',
    outcome: 'fail',
    timestamp: 1000,
  });
  expect(logger.logAsCurrentRole).toHaveBeenCalledWith(
    LogEventId.DiagnosticComplete,
    {
      disposition: 'failure',
      message: 'Diagnostic (test-print) completed with outcome: fail.',
    }
  );

  jest.setSystemTime(new Date(2000));
  api.addDiagnosticRecord({
    type: 'test-print',
    outcome: 'pass',
  });
  expect(api.getMostRecentPrinterDiagnostic()).toEqual<DiagnosticRecord>({
    type: 'test-print',
    outcome: 'pass',
    timestamp: 2000,
  });
  expect(logger.logAsCurrentRole).toHaveBeenCalledWith(
    LogEventId.DiagnosticComplete,
    {
      disposition: 'success',
      message: 'Diagnostic (test-print) completed with outcome: pass.',
    }
  );

  jest.useRealTimers();
});

const reportPrintedTime = new Date('2021-01-01T00:00:00.000');

test('test print', async () => {
  const { api, logger, mockPrinterHandler, auth } = buildTestEnvironment();
  mockSystemAdministratorAuth(auth);

  // can log failure if test page never makes it to the printer
  await api.printTestPage();
  expect(logger.logAsCurrentRole).toHaveBeenCalledWith(
    LogEventId.DiagnosticInit,
    {
      disposition: 'failure',
      message:
        'Error attempting to send test page to the printer: cannot print without printer connected',
    }
  );

  mockPrinterHandler.connectPrinter(HP_LASER_PRINTER_CONFIG);

  await api.printTestPage();
  expect(logger.logAsCurrentRole).toHaveBeenCalledWith(
    LogEventId.DiagnosticInit,
    {
      disposition: 'success',
      message: 'User started a print diagnostic by printing a test page.',
    }
  );

  // it's not important to test the exact content of the test print, only that it
  // prints the sort of text, lines, and shading that will appear on our actual reports
  await expect(mockPrinterHandler.getLastPrintPath()).toMatchPdfSnapshot({
    customSnapshotIdentifier: 'test-print',
  });
});

test('print or save readiness report', async () => {
  const { api, mockPrinterHandler, auth, logger, mockUsbDrive } =
    buildTestEnvironment();
  mockSystemAdministratorAuth(auth);

  await configureMachine(api, auth, electionTwoPartyPrimaryDefinition);
  mockPrinterHandler.connectPrinter(HP_LASER_PRINTER_CONFIG);
  await api.printTestPage();
  jest.useFakeTimers().setSystemTime(new Date('2021-01-01T00:00:00.000'));
  api.addDiagnosticRecord({
    type: 'test-print',
    outcome: 'pass',
  });
  jest.useRealTimers();

  mockUsbDrive.insertUsbDrive({});
  mockUsbDrive.usbDrive.sync.expectCallWith().resolves();
  const exportFileResult = await api.saveReadinessReport();
  exportFileResult.assertOk('error saving readiness report to USB');
  expect(logger.logAsCurrentRole).toHaveBeenCalledWith(
    LogEventId.ReadinessReportSaved,
    {
      disposition: 'success',
      message: 'User saved the equipment readiness report to a USB drive.',
    }
  );

  const printPath = exportFileResult.unsafeUnwrap()[0]!;
  await expect(printPath).toMatchPdfSnapshot({
    customSnapshotIdentifier: 'readiness-report',
  });
});

test('save readiness report failure logging', async () => {
  const { api, auth, logger, mockUsbDrive } = buildTestEnvironment();
  mockSystemAdministratorAuth(auth);

  mockUsbDrive.removeUsbDrive();
  const exportResult = await api.saveReadinessReport();
  exportResult.assertErr('unexpected success saving readiness report to USB');
  expect(logger.logAsCurrentRole).toHaveBeenCalledWith(
    LogEventId.ReadinessReportSaved,
    {
      disposition: 'failure',
      message:
        'Error while attempting to save the equipment readiness report to a USB drive: No USB drive found',
    }
  );
});

test('getApplicationDiskSpaceSummary', async () => {
  const { api } = buildTestEnvironment();

  expect(await api.getApplicationDiskSpaceSummary()).toEqual(
    MOCK_DISK_SPACE_SUMMARY
  );
});
