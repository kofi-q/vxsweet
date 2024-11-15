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

import * as electionGridLayoutNewHampshireTestBallotFixtures from '@vx/libs/fixtures/src/data/electionGridLayoutNewHampshireTestBallot';
import * as electionGridLayoutNewHampshire from '@vx/libs/fixtures/src/data/electionGridLayoutNewHampshireTestBallot/election.json';
import * as electionTwoPartyPrimaryFixtures from '@vx/libs/fixtures/src/data/electionTwoPartyPrimary';
import * as electionTwoPartyPrimary from '@vx/libs/fixtures/src/data/electionTwoPartyPrimary/election.json';
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
import { type TallyReportSpec } from '../reports/tally_report';
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
  reportSpec: TallyReportSpec;
  customSnapshotIdentifier: string;
}) {
  const { pdf } = await api.getTallyReportPreview(reportSpec);
  await expect(pdf).toMatchPdfSnapshot({
    failureThreshold: 0.0001,
    customSnapshotIdentifier,
  });

  await api.printTallyReport(reportSpec);
  const printPath = mockPrinterHandler.getLastPrintPath();
  assert(printPath !== undefined);
  await expect(printPath).toMatchPdfSnapshot({
    failureThreshold: 0.0001,
    customSnapshotIdentifier,
  });

  const exportPath = tmpNameSync();
  const exportResult = await api.exportTallyReportPdf({
    ...reportSpec,
    path: exportPath,
  });
  exportResult.assertOk('export failed');
  await expect(exportPath).toMatchPdfSnapshot({
    failureThreshold: 0.0001,
    customSnapshotIdentifier,
  });
}

// test split into two parts because it is long running
test('general election tally report PDF - Part 1', async () => {
  const electionDefinition =
    electionGridLayoutNewHampshire.toElectionDefinition();

  const { api, auth, mockPrinterHandler } = buildTestEnvironment();
  await configureMachine(api, auth, electionDefinition);
  mockElectionManagerAuth(auth, electionDefinition.election);

  mockPrinterHandler.connectPrinter(HP_LASER_PRINTER_CONFIG);

  function snapshotReport({
    spec,
    identifier,
  }: {
    spec: TallyReportSpec;
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
      groupBy: {},
      includeSignatureLines: false,
    },
    identifier: 'tally-report-zero',
  });

  // shows report with signature
  await snapshotReport({
    spec: {
      filter: {},
      groupBy: {},
      includeSignatureLines: true,
    },
    identifier: 'tally-report-signature-line',
  });
});

test('general election tally report PDF - Part 2', async () => {
  const electionDefinition =
    electionGridLayoutNewHampshire.toElectionDefinition();
  const { castVoteRecordExport } =
    electionGridLayoutNewHampshireTestBallotFixtures;
  const { election } = electionDefinition;

  const { api, auth, mockPrinterHandler } = buildTestEnvironment();
  await configureMachine(api, auth, electionDefinition);
  mockElectionManagerAuth(auth, electionDefinition.election);

  mockPrinterHandler.connectPrinter(HP_LASER_PRINTER_CONFIG);

  function snapshotReport({
    spec,
    identifier,
  }: {
    spec: TallyReportSpec;
    identifier: string;
  }) {
    return expectIdenticalSnapshotsAcrossExportMethods({
      api,
      mockPrinterHandler,
      reportSpec: spec,
      customSnapshotIdentifier: identifier,
    });
  }

  const loadFileResult = await api.addCastVoteRecordFile({
    path: castVoteRecordExport.asDirectoryPath(),
  });
  loadFileResult.assertOk('load file failed');

  // shows full election report populated with data
  await snapshotReport({
    spec: {
      filter: {},
      groupBy: {},
      includeSignatureLines: false,
    },
    identifier: 'tally-report',
  });

  // shows filtered report
  await snapshotReport({
    spec: {
      filter: { votingMethods: ['absentee'] },
      groupBy: {},
      includeSignatureLines: false,
    },
    identifier: 'tally-report-simple-filter',
  });

  // handles report with complex filter
  await snapshotReport({
    spec: {
      filter: {
        votingMethods: ['absentee'],
        precinctIds: ['town-id-00701-precinct-id-default'],
        ballotStyleGroupIds: ['card-number-3'] as BallotStyleGroupId[],
      },
      groupBy: {},
      includeSignatureLines: false,
    },
    identifier: 'tally-report-complex-filter',
  });

  // splits report according to group by
  await snapshotReport({
    spec: {
      filter: {},
      groupBy: { groupByVotingMethod: true },
      includeSignatureLines: false,
    },
    identifier: 'tally-report-grouped',
  });

  await api.setManualResults({
    precinctId: 'town-id-00701-precinct-id-default',
    ballotStyleGroupId: 'card-number-3' as BallotStyleGroupId,
    votingMethod: 'absentee',
    manualResults: buildManualResultsFixture({
      election,
      ballotCount: 10,
      contestResultsSummaries: {
        'Governor-061a401b': {
          type: 'candidate',
          ballots: 10,
          officialOptionTallies: {
            'Josiah-Bartlett-1bb99985': 5,
            'Hannah-Dustin-ab4ef7c8': 3,
            'John-Spencer-9ffb5970': 2,
          },
        },
      },
    }),
  });

  // splits report according to group by
  await snapshotReport({
    spec: {
      filter: {},
      groupBy: {},
      includeSignatureLines: false,
    },
    identifier: 'tally-report-manual',
  });
});

test('tally report PDF - primary', async () => {
  const { castVoteRecordExport } = electionTwoPartyPrimaryFixtures;
  const electionDefinition =
    electionTwoPartyPrimaryFixtures.electionJson.toElectionDefinition();

  const { api, auth, mockPrinterHandler } = buildTestEnvironment();
  await configureMachine(api, auth, electionDefinition);
  mockElectionManagerAuth(auth, electionDefinition.election);

  mockPrinterHandler.connectPrinter(HP_LASER_PRINTER_CONFIG);

  function snapshotReport({
    spec,
    identifier,
  }: {
    spec: TallyReportSpec;
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
      groupBy: {},
      includeSignatureLines: false,
    },
    identifier: 'primary-tally-report-zero',
  });

  const loadFileResult = await api.addCastVoteRecordFile({
    path: castVoteRecordExport.asDirectoryPath(),
  });
  loadFileResult.assertOk('load file failed');

  // shows report populated with data
  await snapshotReport({
    spec: {
      filter: {},
      groupBy: {},
      includeSignatureLines: false,
    },
    identifier: 'primary-tally-report',
  });
});

test('tally report warning', async () => {
  const electionDefinition = electionTwoPartyPrimary.toElectionDefinition();

  const { api, auth } = buildTestEnvironment();
  await configureMachine(api, auth, electionDefinition);
  mockElectionManagerAuth(auth, electionDefinition.election);

  expect(
    (
      await api.getTallyReportPreview({
        filter: {},
        groupBy: {},
        includeSignatureLines: false,
      })
    ).warning
  ).toBeUndefined();

  expect(
    await api.getTallyReportPreview({
      filter: {},
      // grouping by batch is invalid because there are no batches
      groupBy: { groupByBatch: true },
      includeSignatureLines: false,
    })
  ).toEqual({
    pdf: undefined,
    warning: { type: 'no-reports-match-filter' },
  });

  mockOf(renderToPdf).mockResolvedValueOnce(err('content-too-large'));
  expect(
    await api.getTallyReportPreview({
      filter: {},
      groupBy: {},
      includeSignatureLines: false,
    })
  ).toEqual({
    pdf: undefined,
    warning: { type: 'content-too-large' },
  });

  // testing for other cases is in `warnings.test.ts`, here we simply want to
  // confirm that the warning is being passed through
});

test('tally report logging', async () => {
  const electionDefinition = electionTwoPartyPrimary.toElectionDefinition();

  const { api, auth, logger, mockPrinterHandler } = buildTestEnvironment();
  await configureMachine(api, auth, electionDefinition);
  mockElectionManagerAuth(auth, electionDefinition.election);
  mockPrinterHandler.connectPrinter(HP_LASER_PRINTER_CONFIG);

  const MOCK_REPORT_SPEC: TallyReportSpec = {
    filter: {},
    groupBy: { groupByPrecinct: true, groupByVotingMethod: true },
    includeSignatureLines: false,
  };

  // successful file export
  const validTmpFilePath = tmpNameSync();
  const validExportResult = await api.exportTallyReportPdf({
    ...MOCK_REPORT_SPEC,
    path: validTmpFilePath,
  });
  validExportResult.assertOk('export failed');
  expect(logger.logAsCurrentRole).lastCalledWith(LogEventId.FileSaved, {
    disposition: 'success',
    message: `Saved tally report PDF file to ${validTmpFilePath} on the USB drive.`,
    filename: validTmpFilePath,
  });

  // failed file export
  const invalidFilePath = '/invalid/path';
  const invalidExportResult = await api.exportTallyReportPdf({
    ...MOCK_REPORT_SPEC,
    path: invalidFilePath,
  });
  invalidExportResult.assertErr('export should have failed');
  expect(logger.logAsCurrentRole).lastCalledWith(LogEventId.FileSaved, {
    disposition: 'failure',
    message: `Failed to save tally report PDF file to ${invalidFilePath} on the USB drive.`,
    filename: invalidFilePath,
  });

  // successful print
  await api.printTallyReport(MOCK_REPORT_SPEC);
  expect(logger.logAsCurrentRole).lastCalledWith(
    LogEventId.ElectionReportPrinted,
    {
      message: `User printed a tally report.`,
      disposition: 'success',
    }
  );

  // failed print
  mockPrinterHandler.disconnectPrinter();
  await api.printTallyReport(MOCK_REPORT_SPEC);
  expect(logger.logAsCurrentRole).lastCalledWith(
    LogEventId.ElectionReportPrinted,
    {
      message: `Error in attempting to print tally report: cannot print without printer connected`,
      disposition: 'failure',
    }
  );

  // preview
  await api.getTallyReportPreview(MOCK_REPORT_SPEC);
  expect(logger.logAsCurrentRole).lastCalledWith(
    LogEventId.ElectionReportPreviewed,
    {
      message: `User previewed a tally report.`,
      disposition: 'success',
    }
  );
});
