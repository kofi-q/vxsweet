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

import * as electionTwoPartyPrimaryFixtures from '@vx/libs/fixtures/src/data/electionTwoPartyPrimary';
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
import { mockOf } from '@vx/libs/test-utils/src';
import { type BallotStyleGroupId } from '@vx/libs/types/elections';
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
  api,
  mockPrinterHandler,
  reportSpec,
  customSnapshotIdentifier,
}: {
  api: Api;
  mockPrinterHandler: MemoryPrinterHandler;
  reportSpec: BallotCountReportSpec;
  customSnapshotIdentifier: string;
}) {
  const { pdf } = await api.getBallotCountReportPreview(reportSpec);
  await expect(pdf).toMatchPdfSnapshot({
    customSnapshotIdentifier,
    failureThreshold: 0.0001,
  });

  await api.printBallotCountReport(reportSpec);
  const printPath = mockPrinterHandler.getLastPrintPath();
  assert(printPath !== undefined);
  await expect(printPath).toMatchPdfSnapshot({
    customSnapshotIdentifier,
    failureThreshold: 0.0001,
  });

  const exportPath = tmpNameSync();
  const exportResult = await api.exportBallotCountReportPdf({
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
  const { castVoteRecordExport } = electionTwoPartyPrimaryFixtures;
  const electionDefinition =
    electionTwoPartyPrimaryFixtures.electionJson.toElectionDefinition();
  const { election } = electionDefinition;

  const { api, auth, mockPrinterHandler } = buildTestEnvironment();
  await configureMachine(api, auth, electionDefinition);
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
      api,
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

  const loadFileResult = await api.addCastVoteRecordFile({
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

  await api.setManualResults({
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
  const electionDefinition =
    electionTwoPartyPrimaryFixtures.electionJson.toElectionDefinition();

  const { api, auth } = buildTestEnvironment();
  await configureMachine(api, auth, electionDefinition);
  mockElectionManagerAuth(auth, electionDefinition.election);

  expect(
    (
      await api.getBallotCountReportPreview({
        filter: {},
        groupBy: {},
        includeSheetCounts: false,
      })
    ).warning
  ).toBeUndefined();

  expect(
    await api.getBallotCountReportPreview({
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
    await api.getBallotCountReportPreview({
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
  const electionDefinition =
    electionTwoPartyPrimaryFixtures.electionJson.toElectionDefinition();

  const { api, auth, logger, mockPrinterHandler } = buildTestEnvironment();
  await configureMachine(api, auth, electionDefinition);
  mockElectionManagerAuth(auth, electionDefinition.election);
  mockPrinterHandler.connectPrinter(HP_LASER_PRINTER_CONFIG);

  const MOCK_REPORT_SPEC: BallotCountReportSpec = {
    filter: {},
    groupBy: { groupByPrecinct: true, groupByVotingMethod: true },
    includeSheetCounts: false,
  };

  // successful file export
  const validTmpFilePath = tmpNameSync();
  const validExportResult = await api.exportBallotCountReportPdf({
    ...MOCK_REPORT_SPEC,
    path: validTmpFilePath,
  });
  validExportResult.assertOk('export failed');
  expect(logger.logAsCurrentRole).lastCalledWith(LogEventId.FileSaved, {
    disposition: 'success',
    message: `Saved ballot count report PDF file to ${validTmpFilePath} on the USB drive.`,
    filename: validTmpFilePath,
  });

  // failed file export
  const invalidFilePath = '/invalid/path';
  const invalidExportResult = await api.exportBallotCountReportPdf({
    ...MOCK_REPORT_SPEC,
    path: invalidFilePath,
  });
  invalidExportResult.assertErr('export should have failed');
  expect(logger.logAsCurrentRole).lastCalledWith(LogEventId.FileSaved, {
    disposition: 'failure',
    message: `Failed to save ballot count report PDF file to ${invalidFilePath} on the USB drive.`,
    filename: invalidFilePath,
  });

  // successful print
  await api.printBallotCountReport(MOCK_REPORT_SPEC);
  expect(logger.logAsCurrentRole).lastCalledWith(
    LogEventId.ElectionReportPrinted,
    {
      message: `User printed a ballot count report.`,
      disposition: 'success',
    }
  );

  // failed print
  mockPrinterHandler.disconnectPrinter();
  await api.printBallotCountReport(MOCK_REPORT_SPEC);
  expect(logger.logAsCurrentRole).lastCalledWith(
    LogEventId.ElectionReportPrinted,
    {
      message: `Error in attempting to print ballot count report: cannot print without printer connected`,
      disposition: 'failure',
    }
  );

  // preview
  await api.getBallotCountReportPreview(MOCK_REPORT_SPEC);
  expect(logger.logAsCurrentRole).lastCalledWith(
    LogEventId.ElectionReportPreviewed,
    {
      message: `User previewed a ballot count report.`,
      disposition: 'success',
    }
  );
});
