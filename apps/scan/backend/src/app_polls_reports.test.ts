jest.mock('@vx/libs/utils/src', (): typeof import('@vx/libs/utils/src') => {
  return {
    ...jest.requireActual('@vx/libs/utils/src'),
    isFeatureFlagEnabled: (flag) => mockFeatureFlagger.isEnabled(flag),
  };
});

jest.mock('./util/get_current_time', () => ({
  getCurrentTime: () => reportPrintedTime.getTime(),
}));

import {
  BooleanEnvironmentVariableName,
  getFeatureFlagMock,
} from '@vx/libs/utils/src';
import { electionTwoPartyPrimaryDefinition } from '@vx/libs/fixtures/src';
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
});

const reportPrintedTime = new Date('2021-01-01T00:00:00.000');

test('printReport prints first section and printReportSection can print the rest', async () => {
  await withApp(
    async ({
      apiClient,
      mockUsbDrive,
      mockFujitsuPrinterHandler,
      mockAuth,
    }) => {
      await configureApp(apiClient, mockAuth, mockUsbDrive, {
        openPolls: false,
        electionPackage: {
          electionDefinition: electionTwoPartyPrimaryDefinition,
        },
      });
      (await apiClient.openPolls()).unsafeUnwrap();

      // print first section
      await apiClient.printReport();
      await expect(
        mockFujitsuPrinterHandler.getLastPrintPath()
      ).toMatchPdfSnapshot({
        customSnapshotIdentifier: 'polls-opened-report-section-mammal',
        failureThreshold: 0.0001,
      });

      // print second section
      (await apiClient.printReportSection({ index: 1 })).unsafeUnwrap();
      await expect(
        mockFujitsuPrinterHandler.getLastPrintPath()
      ).toMatchPdfSnapshot({
        customSnapshotIdentifier: 'polls-opened-report-section-fish',
        failureThreshold: 0.0001,
      });

      // can reprint a section
      (await apiClient.printReportSection({ index: 1 })).unsafeUnwrap();
      await expect(
        mockFujitsuPrinterHandler.getLastPrintPath()
      ).toMatchPdfSnapshot({
        customSnapshotIdentifier: 'polls-opened-report-section-fish',
        failureThreshold: 0.0001,
      });

      // print third section
      (await apiClient.printReportSection({ index: 2 })).unsafeUnwrap();
      await expect(
        mockFujitsuPrinterHandler.getLastPrintPath()
      ).toMatchPdfSnapshot({
        customSnapshotIdentifier: 'polls-opened-report-section-nonpartisan',
        failureThreshold: 0.0001,
      });

      expect(mockFujitsuPrinterHandler.getPrintPathHistory()).toHaveLength(4);

      mockFujitsuPrinterHandler.cleanup();
    }
  );
});

test('printing report before polls opened should fail', async () => {
  await withApp(async ({ apiClient, mockUsbDrive, mockAuth }) => {
    await configureApp(apiClient, mockAuth, mockUsbDrive, {
      testMode: true,
      openPolls: false,
    });

    // printing report before polls opened should fail
    await suppressingConsoleOutput(async () => {
      await expect(apiClient.printReport()).rejects.toThrow();
    });
  });
});

test('re-printing report after scanning a ballot should fail', async () => {
  await withApp(
    async ({
      apiClient,
      mockUsbDrive,
      mockAuth,
      mockScanner,
      clock,
      workspace,
    }) => {
      await configureApp(apiClient, mockAuth, mockUsbDrive, {
        testMode: true,
        openPolls: false,
      });
      (await apiClient.openPolls()).unsafeUnwrap();

      await scanBallot(mockScanner, clock, apiClient, workspace.store, 0);
      await suppressingConsoleOutput(async () => {
        await expect(apiClient.printReport()).rejects.toThrow();
      });
    }
  );
});

test('can print voting paused and voting resumed reports', async () => {
  await withApp(
    async ({
      apiClient,
      mockScanner,
      mockUsbDrive,
      mockFujitsuPrinterHandler,
      mockAuth,
      workspace,
      clock,
    }) => {
      await configureApp(apiClient, mockAuth, mockUsbDrive, {
        testMode: true,
      });

      await scanBallot(mockScanner, clock, apiClient, workspace.store, 0);

      // pause voting
      await apiClient.pauseVoting();
      await apiClient.printReport();
      await expect(
        mockFujitsuPrinterHandler.getLastPrintPath()
      ).toMatchPdfSnapshot({
        customSnapshotIdentifier: 'voting-paused-report',
        failureThreshold: 0.0001,
      });

      // resume voting
      await apiClient.resumeVoting();
      await apiClient.printReport();
      await expect(
        mockFujitsuPrinterHandler.getLastPrintPath()
      ).toMatchPdfSnapshot({
        customSnapshotIdentifier: 'voting-resumed-report',
        failureThreshold: 0.0001,
      });
    }
  );
});

test('can tabulate results and print polls closed report', async () => {
  await withApp(
    async ({
      apiClient,
      mockScanner,
      mockUsbDrive,
      mockFujitsuPrinterHandler,
      mockAuth,
      workspace,
      clock,
    }) => {
      await configureApp(apiClient, mockAuth, mockUsbDrive, {
        testMode: true,
      });

      await scanBallot(mockScanner, clock, apiClient, workspace.store, 0);
      await scanBallot(mockScanner, clock, apiClient, workspace.store, 1);
      await scanBallot(mockScanner, clock, apiClient, workspace.store, 2);

      // close polls
      await apiClient.closePolls();
      await apiClient.printReport();
      await expect(
        mockFujitsuPrinterHandler.getLastPrintPath()
      ).toMatchPdfSnapshot({
        customSnapshotIdentifier: 'polls-closed-report',
        failureThreshold: 0.0001,
      });
    }
  );
});

/**
 * TODO: Add test coverage for results in a primary election. This will require
 * more robust mocking of ballots for scanning that creates or copies marked
 * ballot images from the HMPB rendering library. Currently we are only testing
 * with ballot images that were individually created and added as fixtures.
 * */
