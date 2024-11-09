jest.mock('@vx/libs/utils/src', (): typeof import('@vx/libs/utils/src') => {
  return {
    ...jest.requireActual('@vx/libs/utils/src'),
    isFeatureFlagEnabled: (flag) => mockFeatureFlagger.isEnabled(flag),
  };
});

jest.mock('../time/get_current_time', () => ({
  getCurrentTime: () => mockTime.getTime(),
}));

jest.mock(
  '@vx/libs/backend/diagnostics',
  (): typeof import('@vx/libs/backend/diagnostics') => ({
    ...jest.requireActual('@vx/libs/backend/diagnostics'),
    initializeGetWorkspaceDiskSpaceSummary: jest.fn(),
  })
);

import {
  BooleanEnvironmentVariableName,
  getFeatureFlagMock,
} from '@vx/libs/utils/src';
import { err } from '@vx/libs/basics/result';
import { LogEventId } from '@vx/libs/logging/src';
import { type DiagnosticRecord } from '@vx/libs/types/diagnostics';
import { mockOf } from '@vx/libs/test-utils/src';
import {
  type DiskSpaceSummary,
  initializeGetWorkspaceDiskSpaceSummary,
} from '@vx/libs/backend/diagnostics';
import { withApp } from '../test/helpers/pdi_helpers';
import { TEST_PRINT_USER_FAIL_REASON } from '../diagnostics/diagnostics';
import { configureApp } from '../test/helpers/shared_helpers';
import '@vx/libs/image-test-utils/register';

jest.setTimeout(60_000);

const mockFeatureFlagger = getFeatureFlagMock();

beforeEach(() => {
  mockFeatureFlagger.enableFeatureFlag(
    BooleanEnvironmentVariableName.SKIP_ELECTION_PACKAGE_AUTHENTICATION
  );
});

const mockTime = new Date('2021-01-01T00:00:00.000');

function wrapWithFakeSystemTime<T>(fn: () => T): T {
  jest.useFakeTimers().setSystemTime(mockTime.getTime());
  const result = fn();
  jest.useRealTimers();
  return result;
}

const MOCK_DISK_SPACE_SUMMARY: DiskSpaceSummary = {
  total: 10 * 1_000_000,
  used: 1 * 1_000_000,
  available: 9 * 1_000_000,
};

beforeEach(() => {
  mockOf(initializeGetWorkspaceDiskSpaceSummary).mockReturnValue(() =>
    Promise.resolve(MOCK_DISK_SPACE_SUMMARY)
  );
});

test('can print test page', async () => {
  await withApp(async ({ api, mockFujitsuPrinterHandler, logger }) => {
    (await api.printTestPage()).unsafeUnwrap();
    await expect(
      mockFujitsuPrinterHandler.getLastPrintPath()
    ).toMatchPdfSnapshot({
      customSnapshotIdentifier: 'print-test-page',
    });
    expect(logger.logAsCurrentRole).toHaveBeenCalledWith(
      LogEventId.DiagnosticInit,
      {
        disposition: 'success',
        message: 'User initiated a test page print.',
      }
    );
  });
});

test('test page failing mid-print is logged', async () => {
  await withApp(async ({ api, mockFujitsuPrinterHandler, logger }) => {
    expect(api.getMostRecentPrinterDiagnostic()).toBeNull();

    mockFujitsuPrinterHandler.setStatus({
      state: 'error',
      type: 'disconnected',
    });
    expect(await wrapWithFakeSystemTime(() => api.printTestPage())).toEqual(
      err({
        state: 'error',
        type: 'disconnected',
      })
    );

    expect(api.getMostRecentPrinterDiagnostic()).toEqual<DiagnosticRecord>({
      message: 'The printer was disconnected while printing.',
      outcome: 'fail',
      timestamp: expect.anything(),
      type: 'test-print',
    });
    expect(logger.logAsCurrentRole).toHaveBeenCalledWith(
      LogEventId.DiagnosticComplete,
      {
        disposition: 'failure',
        message:
          'Test print failed. The printer was disconnected while printing.',
      }
    );
  });
});

test('user logged "pass" after a test print completes', async () => {
  await withApp(({ api, logger }) => {
    expect(api.getMostRecentPrinterDiagnostic()).toBeNull();

    wrapWithFakeSystemTime(() => api.logTestPrintOutcome({ outcome: 'pass' }));

    expect(api.getMostRecentPrinterDiagnostic()).toEqual<DiagnosticRecord>({
      outcome: 'pass',
      timestamp: mockTime.getTime(),
      type: 'test-print',
    });
    expect(logger.logAsCurrentRole).toHaveBeenCalledWith(
      LogEventId.DiagnosticComplete,
      {
        disposition: 'success',
        message: 'Test print successful.',
      }
    );
  });
});

test('user logged "fail" after a test print completes', async () => {
  await withApp(({ api, logger }) => {
    expect(api.getMostRecentPrinterDiagnostic()).toBeNull();

    wrapWithFakeSystemTime(() => api.logTestPrintOutcome({ outcome: 'fail' }));

    expect(api.getMostRecentPrinterDiagnostic()).toEqual<DiagnosticRecord>({
      outcome: 'fail',
      message: TEST_PRINT_USER_FAIL_REASON,
      timestamp: mockTime.getTime(),
      type: 'test-print',
    });
    expect(logger.logAsCurrentRole).toHaveBeenCalledWith(
      LogEventId.DiagnosticComplete,
      {
        disposition: 'failure',
        message: `Test print failed. ${TEST_PRINT_USER_FAIL_REASON}`,
      }
    );
  });
});

test('printing a readiness report ', async () => {
  await withApp(async ({ api, mockUsbDrive, mockAuth, logger, workspace }) => {
    await configureApp(api, mockAuth, mockUsbDrive, {
      testMode: true,
      openPolls: false,
    });
    mockUsbDrive.insertUsbDrive({});
    wrapWithFakeSystemTime(() => {
      api.logTestPrintOutcome({ outcome: 'pass' });
      workspace.store.addDiagnosticRecord({
        type: 'blank-sheet-scan',
        outcome: 'pass',
      });
    });

    const exportResult = await api.saveReadinessReport();
    exportResult.assertOk('Failed to save readiness report');
    expect(logger.logAsCurrentRole).toHaveBeenCalledWith(
      LogEventId.ReadinessReportSaved,
      {
        disposition: 'success',
        message: 'User saved the equipment readiness report to a USB drive.',
      }
    );

    const exportPath = exportResult.ok()![0];
    await expect(exportPath).toMatchPdfSnapshot({
      customSnapshotIdentifier: 'readiness-report',
    });
  });
});
