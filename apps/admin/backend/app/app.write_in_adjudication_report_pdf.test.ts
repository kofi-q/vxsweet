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

import {
  electionGridLayoutNewHampshireTestBallotFixtures,
  electionTwoPartyPrimaryFixtures,
} from '@vx/libs/fixtures/src';
import {
  BooleanEnvironmentVariableName,
  getFeatureFlagMock,
} from '@vx/libs/utils/src';
import { buildManualResultsFixture } from '@vx/libs/utils/src/tabulation';
import { HP_LASER_PRINTER_CONFIG } from '@vx/libs/printing/src/printer';
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

test('write-in adjudication report', async () => {
  const { electionDefinition, castVoteRecordExport } =
    electionGridLayoutNewHampshireTestBallotFixtures;
  const { election } = electionDefinition;

  const { api, auth, mockPrinterHandler } = buildTestEnvironment();
  await configureMachine(api, auth, electionDefinition);
  mockElectionManagerAuth(auth, electionDefinition.election);

  const loadFileResult = await api.addCastVoteRecordFile({
    path: castVoteRecordExport.asDirectoryPath(),
  });
  loadFileResult.assertOk('load file failed');

  const writeInContestId =
    'State-Representatives-Hillsborough-District-34-b1012d38';

  mockPrinterHandler.connectPrinter(HP_LASER_PRINTER_CONFIG);

  async function expectIdenticalSnapshotsAcrossExportMethods(
    customSnapshotIdentifier: string
  ) {
    const preview = await api.getWriteInAdjudicationReportPreview();
    expect(preview.warning).toBeUndefined();
    await expect(preview.pdf).toMatchPdfSnapshot({
      failureThreshold: 0.0001,
      customSnapshotIdentifier,
    });

    await api.printWriteInAdjudicationReport();
    const printPath = mockPrinterHandler.getLastPrintPath();
    assert(printPath !== undefined);
    await expect(printPath).toMatchPdfSnapshot({
      failureThreshold: 0.0001,
      customSnapshotIdentifier,
    });

    const exportPath = tmpNameSync();
    const exportResult = await api.exportWriteInAdjudicationReportPdf({
      path: exportPath,
    });
    exportResult.assertOk('export failed');
    await expect(exportPath).toMatchPdfSnapshot({
      failureThreshold: 0.0001,
      customSnapshotIdentifier,
    });
  }

  await expectIdenticalSnapshotsAcrossExportMethods('wia-report-zero');

  const writeInIds = api.getWriteInAdjudicationQueue({
    contestId: writeInContestId,
  });

  const unofficialCandidate1 = api.addWriteInCandidate({
    contestId: writeInContestId,
    name: 'Unofficial Candidate 1',
  });

  // generate some adjudication information
  for (const [i, writeInId] of writeInIds.entries()) {
    if (i < 24) {
      api.adjudicateWriteIn({
        writeInId,
        type: 'write-in-candidate',
        candidateId: unofficialCandidate1.id,
      });
    } else if (i < 48) {
      api.adjudicateWriteIn({
        writeInId,
        type: 'official-candidate',
        candidateId: 'Obadiah-Carrigan-5c95145a',
      });
    } else {
      api.adjudicateWriteIn({
        writeInId,
        type: 'invalid',
      });
    }
  }

  await expectIdenticalSnapshotsAcrossExportMethods('wia-report-adjudicated');

  // add manual data
  const unofficialCandidate2 = api.addWriteInCandidate({
    contestId: writeInContestId,
    name: 'Unofficial Candidate 2',
  });
  await api.setManualResults({
    ballotStyleGroupId: 'card-number-3' as BallotStyleGroupId,
    votingMethod: 'precinct',
    precinctId: 'town-id-00701-precinct-id-default',
    manualResults: buildManualResultsFixture({
      election,
      ballotCount: 25,
      contestResultsSummaries: {
        [writeInContestId]: {
          type: 'candidate',
          ballots: 25,
          overvotes: 3,
          undervotes: 2,
          writeInOptionTallies: {
            [unofficialCandidate1.id]: {
              name: 'Unofficial Candidate 1',
              tally: 6,
            },
            [unofficialCandidate2.id]: {
              name: 'Unofficial Candidate 2',
              tally: 4,
            },
          },
          officialOptionTallies: {
            'Obadiah-Carrigan-5c95145a': 10,
          },
        },
      },
    }),
  });

  await expectIdenticalSnapshotsAcrossExportMethods(
    'wia-report-adjudicated-plus-manual'
  );
});

test('write-in adjudication report logging', async () => {
  const { electionDefinition } =
    electionGridLayoutNewHampshireTestBallotFixtures;

  const { api, auth, logger, mockPrinterHandler } = buildTestEnvironment();
  await configureMachine(api, auth, electionDefinition);
  mockElectionManagerAuth(auth, electionDefinition.election);
  mockPrinterHandler.connectPrinter(HP_LASER_PRINTER_CONFIG);

  // successful file export
  const validTmpFilePath = tmpNameSync();
  const validExportResult = await api.exportWriteInAdjudicationReportPdf({
    path: validTmpFilePath,
  });
  validExportResult.assertOk('export failed');
  expect(logger.logAsCurrentRole).lastCalledWith(LogEventId.FileSaved, {
    disposition: 'success',
    message: `Saved write-in adjudication report PDF file to ${validTmpFilePath} on the USB drive.`,
    filename: validTmpFilePath,
  });

  // failed file export
  const invalidFilePath = '/invalid/path';
  const invalidExportResult = await api.exportWriteInAdjudicationReportPdf({
    path: invalidFilePath,
  });
  invalidExportResult.assertErr('export should have failed');
  expect(logger.logAsCurrentRole).lastCalledWith(LogEventId.FileSaved, {
    disposition: 'failure',
    message: `Failed to save write-in adjudication report PDF file to ${invalidFilePath} on the USB drive.`,
    filename: invalidFilePath,
  });

  // successful print
  await api.printWriteInAdjudicationReport();
  expect(logger.logAsCurrentRole).lastCalledWith(
    LogEventId.ElectionReportPrinted,
    {
      message: `User printed the write-in adjudication report.`,
      disposition: 'success',
    }
  );

  // failed print
  mockPrinterHandler.disconnectPrinter();
  await api.printWriteInAdjudicationReport();
  expect(logger.logAsCurrentRole).lastCalledWith(
    LogEventId.ElectionReportPrinted,
    {
      message: `Error in attempting to print the write-in adjudication report: cannot print without printer connected`,
      disposition: 'failure',
    }
  );

  // preview
  await api.getWriteInAdjudicationReportPreview();
  expect(logger.logAsCurrentRole).lastCalledWith(
    LogEventId.ElectionReportPreviewed,
    {
      message: `User previewed the write-in adjudication report.`,
      disposition: 'success',
    }
  );
});

test('write-in adjudication report warning', async () => {
  const { electionDefinition } = electionTwoPartyPrimaryFixtures;
  const { api, auth } = buildTestEnvironment();
  await configureMachine(api, auth, electionDefinition);
  mockElectionManagerAuth(auth, electionDefinition.election);

  mockOf(renderToPdf).mockResolvedValueOnce(err('content-too-large'));
  expect(await api.getWriteInAdjudicationReportPreview()).toEqual({
    pdf: undefined,
    warning: { type: 'content-too-large' },
  });
});
