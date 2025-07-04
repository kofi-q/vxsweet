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

jest.mock('../time/get_current_time', () => ({
  getCurrentTime: () => reportPrintedTime.getTime(),
}));

import { mockOf } from '@vx/libs/test-utils/src';
import {
  type DiskSpaceSummary,
  initializeGetWorkspaceDiskSpaceSummary,
} from '@vx/libs/backend/diagnostics';
import { getBatteryInfo } from '@vx/libs/backend/system_call';
import { LogEventId } from '@vx/libs/logging/src';
import { join } from 'node:path';
import { type DiagnosticRecord } from '@vx/libs/types/diagnostics';
import { TEST_JURISDICTION } from '@vx/libs/types/elections';
import * as electionTwoPartyPrimary from '@vx/libs/fixtures/src/data/electionTwoPartyPrimary/election.json';
import { mockSystemAdministratorAuth } from '../test/helpers/auth';
import { withApp } from '../test/helpers/setup_app';
import '@vx/libs/image-test-utils/register';

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

test('getDiskSpaceSummary', async () => {
  await withApp(async ({ apiClient }) => {
    expect(await apiClient.getApplicationDiskSpaceSummary()).toEqual(
      MOCK_DISK_SPACE_SUMMARY
    );
  });
});

const reportPrintedTime = new Date('2021-01-01T00:00:00.000');

const jurisdiction = TEST_JURISDICTION;

test('save readiness report', async () => {
  const electionDefinition = electionTwoPartyPrimary.toElectionDefinition();
  await withApp(
    async ({ apiClient, mockUsbDrive, scanner, auth, logger, importer }) => {
      mockSystemAdministratorAuth(auth);
      importer.configure(
        electionDefinition,
        jurisdiction,
        'test-election-package-hash'
      );

      // mock a successful scan diagnostic
      jest.useFakeTimers();
      jest.setSystemTime(reportPrintedTime.getTime());
      scanner
        .withNextScannerSession()
        .sheet({
          frontPath: join(__dirname, '../test/fixtures/blank-sheet-front.jpg'),
          backPath: join(__dirname, '../test/fixtures/blank-sheet-back.jpg'),
        })
        .end();
      await apiClient.performScanDiagnostic();
      jest.useRealTimers();

      mockUsbDrive.insertUsbDrive({});
      mockUsbDrive.usbDrive.sync.expectCallWith().resolves();
      const exportResult = await apiClient.saveReadinessReport();
      exportResult.assertOk('Failed to save readiness report');
      expect(logger.log).toHaveBeenCalledWith(
        LogEventId.ReadinessReportSaved,
        'system_administrator',
        {
          disposition: 'success',
          message: 'User saved the equipment readiness report to a USB drive.',
        }
      );

      const exportPath = exportResult.ok()![0];
      await expect(exportPath).toMatchPdfSnapshot({
        customSnapshotIdentifier: 'readiness-report',
      });

      mockUsbDrive.removeUsbDrive();
    }
  );
});

describe('scan diagnostic', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(0);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('pass', async () => {
    await withApp(async ({ apiClient, scanner, auth, logger }) => {
      mockSystemAdministratorAuth(auth);

      scanner
        .withNextScannerSession()
        .sheet({
          frontPath: join(__dirname, '../test/fixtures/blank-sheet-front.jpg'),
          backPath: join(__dirname, '../test/fixtures/blank-sheet-back.jpg'),
        })
        .end();

      await apiClient.performScanDiagnostic();

      expect(
        await apiClient.getMostRecentScannerDiagnostic()
      ).toEqual<DiagnosticRecord>({
        type: 'blank-sheet-scan',
        outcome: 'pass',
        timestamp: 0,
      });

      expect(logger.logAsCurrentRole).toHaveBeenCalledWith(
        LogEventId.DiagnosticInit,
        {
          message:
            'Starting diagnostic scan. Test sheet should be a blank sheet of white paper.',
        }
      );
      expect(logger.logAsCurrentRole).toHaveBeenCalledWith(
        LogEventId.DiagnosticComplete,
        {
          disposition: 'success',
          message: 'Diagnostic scan succeeded.',
        }
      );
    });
  });

  test('fail on first page', async () => {
    await withApp(async ({ apiClient, scanner, auth, logger }) => {
      mockSystemAdministratorAuth(auth);

      scanner
        .withNextScannerSession()
        .sheet({
          frontPath: join(__dirname, '../test/fixtures/streaked-page.jpg'),
          backPath: join(__dirname, '../test/fixtures/blank-sheet-back.jpg'),
        })
        .end();
      await apiClient.performScanDiagnostic();

      expect(
        await apiClient.getMostRecentScannerDiagnostic()
      ).toEqual<DiagnosticRecord>({
        type: 'blank-sheet-scan',
        outcome: 'fail',
        timestamp: 0,
      });
      expect(logger.logAsCurrentRole).toHaveBeenCalledWith(
        LogEventId.DiagnosticComplete,
        {
          disposition: 'failure',
          message:
            'Diagnostic scan failed. The paper may not be blank or the scanner may need to be cleaned.',
        }
      );
    });
  });

  test('fail on second page', async () => {
    await withApp(async ({ apiClient, scanner, auth, logger }) => {
      mockSystemAdministratorAuth(auth);

      scanner
        .withNextScannerSession()
        .sheet({
          frontPath: join(__dirname, '../test/fixtures/blank-sheet-front.jpg'),
          backPath: join(__dirname, '../test/fixtures/streaked-page.jpg'),
        })
        .end();
      await apiClient.performScanDiagnostic();

      expect(
        await apiClient.getMostRecentScannerDiagnostic()
      ).toEqual<DiagnosticRecord>({
        type: 'blank-sheet-scan',
        outcome: 'fail',
        timestamp: 0,
      });
      expect(logger.logAsCurrentRole).toHaveBeenCalledWith(
        LogEventId.DiagnosticComplete,
        {
          disposition: 'failure',
          message:
            'Diagnostic scan failed. The paper may not be blank or the scanner may need to be cleaned.',
        }
      );
    });
  });

  test('fail on no scan ', async () => {
    await withApp(async ({ apiClient, scanner, auth, logger }) => {
      mockSystemAdministratorAuth(auth);

      scanner.withNextScannerSession().end();
      await apiClient.performScanDiagnostic();

      expect(
        await apiClient.getMostRecentScannerDiagnostic()
      ).toEqual<DiagnosticRecord>({
        type: 'blank-sheet-scan',
        outcome: 'fail',
        timestamp: 0,
      });
      expect(logger.logAsCurrentRole).toHaveBeenCalledWith(
        LogEventId.DiagnosticComplete,
        {
          disposition: 'failure',
          message: 'No test sheet detected for scan diagnostic.',
        }
      );
    });
  });
});
