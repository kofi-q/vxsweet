jest.mock('@vx/libs/utils/src', () => {
  return {
    ...jest.requireActual('@vx/libs/utils/src'),
    isFeatureFlagEnabled: (flag: BooleanEnvironmentVariableName) =>
      featureFlagMock.isEnabled(flag),
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
import { tmpNameSync } from 'tmp';
import { readFileSync } from 'node:fs';
import { LogEventId } from '@vx/libs/logging/src';
import { Tabulation } from '@vx/libs/types/tabulation';
import { parseCsv } from '../test/csv';
import {
  buildTestEnvironment,
  configureMachine,
  mockElectionManagerAuth,
} from '../test/app';
import { type Api } from './app';

jest.setTimeout(60_000);

// mock SKIP_CVR_BALLOT_HASH_CHECK to allow us to use old cvr fixtures
const featureFlagMock = getFeatureFlagMock();

beforeEach(() => {
  jest.restoreAllMocks();
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

it('logs success if export succeeds', async () => {
  const electionDefinition = electionTwoPartyPrimary.toElectionDefinition();
  const { castVoteRecordExport } = electionTwoPartyPrimaryFixtures;

  const { api, auth, logger } = buildTestEnvironment();
  await configureMachine(api, auth, electionDefinition);
  mockElectionManagerAuth(auth, electionDefinition.election);

  const loadFileResult = await api.addCastVoteRecordFile({
    path: castVoteRecordExport.asDirectoryPath(),
  });
  loadFileResult.assertOk('load file failed');

  const offLimitsPath = '/root/hidden';
  const failedExportResult = await api.exportBallotCountReportCsv({
    path: offLimitsPath,
    filter: {},
    groupBy: {},
    includeSheetCounts: false,
  });
  expect(failedExportResult.isErr()).toEqual(true);
  expect(logger.logAsCurrentRole).toHaveBeenLastCalledWith(
    LogEventId.FileSaved,
    {
      disposition: 'failure',
      filename: offLimitsPath,
      message: `Failed to save ballot count report CSV file to ${offLimitsPath} on the USB drive.`,
    }
  );
});

it('logs failure if export fails', async () => {
  const electionDefinition = electionTwoPartyPrimary.toElectionDefinition();
  const { castVoteRecordExport } = electionTwoPartyPrimaryFixtures;

  const { api, auth, logger } = buildTestEnvironment();
  await configureMachine(api, auth, electionDefinition);
  mockElectionManagerAuth(auth, electionDefinition.election);

  const loadFileResult = await api.addCastVoteRecordFile({
    path: castVoteRecordExport.asDirectoryPath(),
  });
  loadFileResult.assertOk('load file failed');

  const path = tmpNameSync();
  const exportResult = await api.exportBallotCountReportCsv({
    path,
    filter: {},
    groupBy: {},
    includeSheetCounts: false,
  });
  expect(exportResult.isOk()).toEqual(true);
  expect(logger.logAsCurrentRole).toHaveBeenLastCalledWith(
    LogEventId.FileSaved,
    {
      disposition: 'success',
      filename: path,
      message: `Saved ballot count report CSV file to ${path} on the USB drive.`,
    }
  );
});

async function getParsedExport({
  api,
  groupBy = {},
  filter = {},
}: {
  api: Api;
  groupBy?: Tabulation.GroupBy;
  filter?: Tabulation.Filter;
}): Promise<ReturnType<typeof parseCsv>> {
  const path = tmpNameSync();
  const exportResult = await api.exportBallotCountReportCsv({
    path,
    groupBy,
    filter,
    includeSheetCounts: false,
  });
  expect(exportResult.isOk()).toEqual(true);
  return parseCsv(readFileSync(path, 'utf-8').toString());
}

it('creates accurate ballot count reports', async () => {
  const electionDefinition =
    electionGridLayoutNewHampshire.toElectionDefinition();
  const { castVoteRecordExport } =
    electionGridLayoutNewHampshireTestBallotFixtures;
  const { election } = electionDefinition;

  const { api, auth } = buildTestEnvironment();
  await configureMachine(api, auth, electionDefinition);
  mockElectionManagerAuth(auth, electionDefinition.election);

  // add CVR data
  const loadFileResult = await api.addCastVoteRecordFile({
    path: castVoteRecordExport.asDirectoryPath(),
  });
  loadFileResult.assertOk('load file failed');

  // add manual data
  await api.setManualResults({
    precinctId: election.precincts[0]!.id,
    votingMethod: 'absentee',
    ballotStyleGroupId: election.ballotStyles[0]!.groupId,
    manualResults: buildManualResultsFixture({
      election,
      ballotCount: 10,
      contestResultsSummaries: {},
    }),
  });

  expect(
    await getParsedExport({
      api,
      groupBy: { groupByVotingMethod: true },
    })
  ).toEqual({
    headers: ['Voting Method', 'Manual', 'BMD', 'HMPB', 'Total'],
    rows: [
      {
        Manual: '0',
        BMD: '0',
        HMPB: '92',
        Total: '92',
        'Voting Method': 'Precinct',
      },
      {
        Manual: '10',
        BMD: '0',
        HMPB: '92',
        Total: '102',
        'Voting Method': 'Absentee',
      },
    ],
  });

  expect(
    await getParsedExport({
      api,
      groupBy: { groupByPrecinct: true, groupByVotingMethod: true },
    })
  ).toEqual({
    headers: [
      'Precinct',
      'Precinct ID',
      'Voting Method',
      'Manual',
      'BMD',
      'HMPB',
      'Total',
    ],
    rows: [
      {
        BMD: '0',
        HMPB: '92',
        Manual: '0',
        Precinct: 'Test Ballot',
        'Precinct ID': 'town-id-00701-precinct-id-default',
        Total: '92',
        'Voting Method': 'Precinct',
      },
      {
        BMD: '0',
        HMPB: '92',
        Manual: '10',
        Precinct: 'Test Ballot',
        'Precinct ID': 'town-id-00701-precinct-id-default',
        Total: '102',
        'Voting Method': 'Absentee',
      },
    ],
  });
});
