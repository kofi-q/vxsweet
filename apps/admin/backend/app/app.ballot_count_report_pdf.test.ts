jest.mock('../util/time/get_current_time', () => ({
  getCurrentTime: () => reportPrintedTime.getTime(),
}));

jest.mock('@vx/libs/utils/src', () => {
  return {
    ...jest.requireActual('@vx/libs/utils/src'),
    isFeatureFlagEnabled: (flag: BooleanEnvironmentVariableName) =>
      featureFlagMock.isEnabled(flag),
  };
});

jest.mock('@vx/libs/printing/src', () => {
  const original = jest.requireActual('@vx/libs/printing/src');
  return {
    ...original,
    renderToPdf: jest.fn(original.renderToPdf),
  };
});

import { electionTwoPartyPrimaryFixtures } from '@vx/libs/fixtures/src';
import {
  BooleanEnvironmentVariableName,
  getFeatureFlagMock,
} from '@vx/libs/utils/src';
import { buildManualResultsFixture } from '@vx/libs/utils/src/tabulation';
import {
  HP_LASER_PRINTER_CONFIG,
  type MemoryPrinterHandler,
} from '@vx/libs/printing/src/printer';
import { renderToPdf } from '@vx/libs/printing/src';
import { assert } from '@vx/libs/basics/assert';
import { err } from '@vx/libs/basics/result';
import { tmpNameSync } from 'tmp';
import { LogEventId } from '@vx/libs/logging/src';
import { type Client } from '@vx/libs/grout/src';
import { mockOf } from '@vx/libs/test-utils/src';
import { type BallotStyleGroupId } from '@vx/libs/types/src';
import {
  buildTestEnvironment,
  configureMachine,
  mockElectionManagerAuth,
} from '../test/app';
import { type Api } from './app';
import { type BallotCountReportSpec } from '../reports/ballot_count_report';
import '@vx/libs/image-test-utils/register';

jest.setTimeout(60_000);

const reportPrintedTime = new Date('2021-01-01T00:00:00.000');

// mock SKIP_CVR_BALLOT_HASH_CHECK to allow us to use old cvr fixtures
const featureFlagMock = getFeatureFlagMock();

beforeEach(() => {
  featureFlagMock.enableFeatureFlag(
    BooleanEnvironmentVariableName.SKIP_CVR_BALLOT_HASH_CHECK
  );
  featureFlagMock.enableFeatureFlag(
    BooleanEnvironmentVariableName.SKIP_CAST_VOTE_RECORDS_AUTHENTICATION
  );
});

afterEach(() => {
  featureFlagMock.resetFeatureFlags();
});

async function expectIdenticalSnapshotsAcrossExportMethods({
  apiClient,
  mockPrinterHandler,
  reportSpec,
  customSnapshotIdentifier,
}: {
  apiClient: Client<Api>;
  mockPrinterHandler: MemoryPrinterHandler;
  reportSpec: BallotCountReportSpec;
  customSnapshotIdentifier: string;
}) {
  const { pdf } = await apiClient.getBallotCountReportPreview(reportSpec);
  await expect(pdf).toMatchPdfSnapshot({
    customSnapshotIdentifier,
    failureThreshold: 0.0001,
  });

  await apiClient.printBallotCountReport(reportSpec);
  const printPath = mockPrinterHandler.getLastPrintPath();
  assert(printPath !== undefined);
  await expect(printPath).toMatchPdfSnapshot({
    customSnapshotIdentifier,
    failureThreshold: 0.0001,
  });

  const exportPath = tmpNameSync();
  const exportResult = await apiClient.exportBallotCountReportPdf({
    ...reportSpec,
    path: exportPath,
  });
  exportResult.assertOk('export failed');
  await expect(exportPath).toMatchPdfSnapshot({
    customSnapshotIdentifier,
    failureThreshold: 0.0001,
  });
}

test('ballot count report PDF', async () => {
  const { electionDefinition, castVoteRecordExport } =
    electionTwoPartyPrimaryFixtures;
  const { election } = electionDefinition;

  const { apiClient, auth, mockPrinterHandler } = buildTestEnvironment();
  await configureMachine(apiClient, auth, electionDefinition);
  mockElectionManagerAuth(auth, electionDefinition.election);

  mockPrinterHandler.connectPrinter(HP_LASER_PRINTER_CONFIG);

  function snapshotReport({
    spec,
    identifier,
  }: {
    spec: BallotCountReportSpec;
    identifier: string;
  }) {
    return expectIdenticalSnapshotsAcrossExportMethods({
      apiClient,
      mockPrinterHandler,
      reportSpec: spec,
      customSnapshotIdentifier: identifier,
    });
  }

  // shows report with all zeros
  await snapshotReport({
    spec: {
      filter: {},
      groupBy: { groupByPrecinct: true, groupByVotingMethod: true },
      includeSheetCounts: false,
    },
    identifier: 'ballot-count-report-zero',
  });

  const loadFileResult = await apiClient.addCastVoteRecordFile({
    path: castVoteRecordExport.asDirectoryPath(),
  });
  loadFileResult.assertOk('load file failed');

  // shows report populated with data
  await snapshotReport({
    spec: {
      filter: {},
      groupBy: { groupByPrecinct: true, groupByVotingMethod: true },
      includeSheetCounts: false,
    },
    identifier: 'ballot-count-report',
  });

  // applies filters and gives report specific title
  await snapshotReport({
    spec: {
      filter: { precinctIds: ['precinct-1'] },
      groupBy: { groupByPrecinct: true, groupByVotingMethod: true },
      includeSheetCounts: false,
    },
    identifier: 'ballot-count-report-simple-filter',
  });

  // handles custom filters
  await snapshotReport({
    spec: {
      filter: {
        precinctIds: ['precinct-1'],
        votingMethods: ['precinct'],
        ballotStyleGroupIds: ['1M'] as BallotStyleGroupId[],
      },
      groupBy: { groupByPrecinct: true, groupByVotingMethod: true },
      includeSheetCounts: false,
    },
    identifier: 'ballot-count-report-complex-filter',
  });

  // shows sheet counts
  await snapshotReport({
    spec: {
      filter: {},
      groupBy: { groupByPrecinct: true, groupByVotingMethod: true },
      includeSheetCounts: true,
    },
    identifier: 'ballot-count-report-sheet-counts',
  });

  await apiClient.setManualResults({
    precinctId: 'precinct-1',
    ballotStyleGroupId: '1M' as BallotStyleGroupId,
    votingMethod: 'precinct',
    manualResults: buildManualResultsFixture({
      election,
      ballotCount: 10,
      contestResultsSummaries: {},
    }),
  });

  // shows manual data
  await snapshotReport({
    spec: {
      filter: {},
      groupBy: { groupByPrecinct: true, groupByVotingMethod: true },
      includeSheetCounts: false,
    },
    identifier: 'ballot-count-report-manual',
  });
});

test('ballot count report warning', async () => {
  const { electionDefinition } = electionTwoPartyPrimaryFixtures;

  const { apiClient, auth } = buildTestEnvironment();
  await configureMachine(apiClient, auth, electionDefinition);
  mockElectionManagerAuth(auth, electionDefinition.election);

  expect(
    (
      await apiClient.getBallotCountReportPreview({
        filter: {},
        groupBy: {},
        includeSheetCounts: false,
      })
    ).warning
  ).toBeUndefined();

  expect(
    await apiClient.getBallotCountReportPreview({
      filter: {},
      // grouping by batch is invalid because there are no batches
      groupBy: { groupByBatch: true },
      includeSheetCounts: false,
    })
  ).toEqual({
    pdf: undefined,
    warning: { type: 'no-reports-match-filter' },
  });

  mockOf(renderToPdf).mockResolvedValueOnce(err('content-too-large'));
  expect(
    await apiClient.getBallotCountReportPreview({
      filter: {},
      groupBy: {},
      includeSheetCounts: false,
    })
  ).toEqual({
    pdf: undefined,
    warning: { type: 'content-too-large' },
  });
});

test('ballot count report logging', async () => {
  const { electionDefinition } = electionTwoPartyPrimaryFixtures;

  const { apiClient, auth, logger, mockPrinterHandler } =
    buildTestEnvironment();
  await configureMachine(apiClient, auth, electionDefinition);
  mockElectionManagerAuth(auth, electionDefinition.election);
  mockPrinterHandler.connectPrinter(HP_LASER_PRINTER_CONFIG);

  const MOCK_REPORT_SPEC: BallotCountReportSpec = {
    filter: {},
    groupBy: { groupByPrecinct: true, groupByVotingMethod: true },
    includeSheetCounts: false,
  };

  // successful file export
  const validTmpFilePath = tmpNameSync();
  const validExportResult = await apiClient.exportBallotCountReportPdf({
    ...MOCK_REPORT_SPEC,
    path: validTmpFilePath,
  });
  validExportResult.assertOk('export failed');
  expect(logger.log).lastCalledWith(LogEventId.FileSaved, 'election_manager', {
    disposition: 'success',
    message: `Saved ballot count report PDF file to ${validTmpFilePath} on the USB drive.`,
    filename: validTmpFilePath,
  });

  // failed file export
  const invalidFilePath = '/invalid/path';
  const invalidExportResult = await apiClient.exportBallotCountReportPdf({
    ...MOCK_REPORT_SPEC,
    path: invalidFilePath,
  });
  invalidExportResult.assertErr('export should have failed');
  expect(logger.log).lastCalledWith(LogEventId.FileSaved, 'election_manager', {
    disposition: 'failure',
    message: `Failed to save ballot count report PDF file to ${invalidFilePath} on the USB drive.`,
    filename: invalidFilePath,
  });

  // successful print
  await apiClient.printBallotCountReport(MOCK_REPORT_SPEC);
  expect(logger.log).lastCalledWith(
    LogEventId.ElectionReportPrinted,
    'election_manager',
    {
      message: `User printed a ballot count report.`,
      disposition: 'success',
    }
  );

  // failed print
  mockPrinterHandler.disconnectPrinter();
  await apiClient.printBallotCountReport(MOCK_REPORT_SPEC);
  expect(logger.log).lastCalledWith(
    LogEventId.ElectionReportPrinted,
    'election_manager',
    {
      message: `Error in attempting to print ballot count report: cannot print without printer connected`,
      disposition: 'failure',
    }
  );

  // preview
  await apiClient.getBallotCountReportPreview(MOCK_REPORT_SPEC);
  expect(logger.log).lastCalledWith(
    LogEventId.ElectionReportPreviewed,
    'election_manager',
    {
      message: `User previewed a ballot count report.`,
      disposition: 'success',
    }
  );
});
