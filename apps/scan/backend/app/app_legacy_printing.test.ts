jest.mock('@vx/libs/utils/src', (): typeof import('@vx/libs/utils/src') => {
  return {
    ...jest.requireActual('@vx/libs/utils/src'),
    isFeatureFlagEnabled: (flag) => mockFeatureFlagger.isEnabled(flag),
  };
});

jest.mock('../time/get_current_time', () => ({
  getCurrentTime: () => reportPrintedTime.getTime(),
}));

import { assert } from '@vx/libs/basics/assert';
import {
  BooleanEnvironmentVariableName,
  getFeatureFlagMock,
} from '@vx/libs/utils/src';
import { BROTHER_THERMAL_PRINTER_CONFIG } from '@vx/libs/printing/src/printer';
import { suppressingConsoleOutput } from '@vx/libs/test-utils/src';
import { configureApp } from '../test/helpers/shared_helpers';
import { scanBallot, withApp } from '../test/helpers/pdi_helpers';
import '@vx/libs/image-test-utils/register';

jest.setTimeout(60_000);

const mockFeatureFlagger = getFeatureFlagMock();

beforeEach(() => {
  mockFeatureFlagger.enableFeatureFlag(
    BooleanEnvironmentVariableName.SKIP_ELECTION_PACKAGE_AUTHENTICATION
  );
  mockFeatureFlagger.enableFeatureFlag(
    BooleanEnvironmentVariableName.USE_BROTHER_PRINTER
  );
});

const reportPrintedTime = new Date('2021-01-01T00:00:00.000');

test('can print and re-print polls opened report', async () => {
  await withApp(
    async ({
      api,
      mockScanner,
      mockUsbDrive,
      mockPrinterHandler,
      mockAuth,
      workspace,
      clock,
    }) => {
      mockPrinterHandler.connectPrinter(BROTHER_THERMAL_PRINTER_CONFIG);
      await configureApp(api, mockAuth, mockUsbDrive, {
        testMode: true,
        openPolls: false,
      });

      // printing report before polls opened should fail
      await suppressingConsoleOutput(async () => {
        await expect(api.printReport()).rejects.toThrow();
      });

      // initial polls opened report
      api.openPolls().unsafeUnwrap();
      await api.printReport();
      const initialReportPath = mockPrinterHandler.getLastPrintPath();
      assert(initialReportPath !== undefined);
      await expect(initialReportPath).toMatchPdfSnapshot({
        customSnapshotIdentifier: 'legacy-polls-opened-report',
        failureThreshold: 0.0001,
      });

      // allows re-printing identical polls opened report
      await api.printReport();
      const reprintedReportPath = mockPrinterHandler.getLastPrintPath();
      assert(reprintedReportPath !== undefined);
      await expect(reprintedReportPath).toMatchPdfSnapshot({
        customSnapshotIdentifier: 'legacy-polls-opened-report',
        failureThreshold: 0.0001,
      });

      // scan a ballot
      await scanBallot(mockScanner, clock, api, workspace.store, 0);

      // you should not be able to print polls opened reports after scanning
      await suppressingConsoleOutput(async () => {
        await expect(api.printReport()).rejects.toThrow();
      });
    }
  );
});

test('can print voting paused and voting resumed reports', async () => {
  await withApp(
    async ({
      api,
      mockScanner,
      mockUsbDrive,
      mockPrinterHandler,
      mockAuth,
      workspace,
      clock,
    }) => {
      mockPrinterHandler.connectPrinter(BROTHER_THERMAL_PRINTER_CONFIG);
      await configureApp(api, mockAuth, mockUsbDrive, {
        testMode: true,
      });

      await scanBallot(mockScanner, clock, api, workspace.store, 0);

      // pause voting
      api.pauseVoting();
      await api.printReport();
      await expect(mockPrinterHandler.getLastPrintPath()).toMatchPdfSnapshot({
        customSnapshotIdentifier: 'legacy-voting-paused-report',
        failureThreshold: 0.0001,
      });

      // resume voting
      api.resumeVoting();
      await api.printReport();
      await expect(mockPrinterHandler.getLastPrintPath()).toMatchPdfSnapshot({
        customSnapshotIdentifier: 'legacy-voting-resumed-report',
        failureThreshold: 0.0001,
      });
    }
  );
});

test('can tabulate results and print polls closed report', async () => {
  await withApp(
    async ({
      api,
      mockScanner,
      mockUsbDrive,
      mockPrinterHandler,
      mockAuth,
      workspace,
      clock,
    }) => {
      mockPrinterHandler.connectPrinter(BROTHER_THERMAL_PRINTER_CONFIG);
      await configureApp(api, mockAuth, mockUsbDrive, {
        testMode: true,
      });

      await scanBallot(mockScanner, clock, api, workspace.store, 0);
      await scanBallot(mockScanner, clock, api, workspace.store, 1);
      await scanBallot(mockScanner, clock, api, workspace.store, 2);

      // close polls
      await api.closePolls();
      await api.printReport();
      await expect(mockPrinterHandler.getLastPrintPath()).toMatchPdfSnapshot({
        customSnapshotIdentifier: 'legacy-polls-closed-report',
        failureThreshold: 0.0001,
      });
    }
  );
});
