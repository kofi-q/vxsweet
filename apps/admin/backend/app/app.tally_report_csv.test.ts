jest.mock('@vx/libs/utils/src', () => {
  return {
    ...jest.requireActual('@vx/libs/utils/src'),
    isFeatureFlagEnabled: (flag: BooleanEnvironmentVariableName) =>
      featureFlagMock.isEnabled(flag),
  };
});

import * as electionGridLayoutNewHampshireTestBallotFixtures from '@vx/libs/fixtures/src/data/electionGridLayoutNewHampshireTestBallot';
import * as electionPrimaryPrecinctSplitsFixtures from '@vx/libs/fixtures/src/data/electionPrimaryPrecinctSplits';
import * as electionTwoPartyPrimaryFixtures from '@vx/libs/fixtures/src/data/electionTwoPartyPrimary';
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

async function getParsedExport({
  api,
  groupBy,
  filter,
}: {
  api: Api;
  groupBy: Tabulation.GroupBy;
  filter: Tabulation.Filter;
}): Promise<ReturnType<typeof parseCsv>> {
  const path = tmpNameSync();
  const exportResult = await api.exportTallyReportCsv({
    path,
    groupBy,
    filter,
  });
  expect(exportResult.isOk()).toEqual(true);
  return parseCsv(readFileSync(path, 'utf-8').toString());
}

it('exports expected results for full election', async () => {
  const { castVoteRecordExport } = electionTwoPartyPrimaryFixtures;
  const electionDefinition =
    electionTwoPartyPrimaryFixtures.electionJson.toElectionDefinition();

  const { api, auth, logger } = buildTestEnvironment();
  await configureMachine(api, auth, electionDefinition);
  mockElectionManagerAuth(auth, electionDefinition.election);

  const loadFileResult = await api.addCastVoteRecordFile({
    path: castVoteRecordExport.asDirectoryPath(),
  });
  loadFileResult.assertOk('load file failed');

  const path = tmpNameSync();
  const exportResult = await api.exportTallyReportCsv({
    filter: {},
    groupBy: {},
    path,
  });
  expect(exportResult.isOk()).toEqual(true);
  expect(logger.logAsCurrentRole).toHaveBeenLastCalledWith(
    LogEventId.FileSaved,
    {
      disposition: 'success',
      filename: path,
      message: `Saved tally report CSV file to ${path} on the USB drive.`,
    }
  );

  const fileContent = readFileSync(path, 'utf-8').toString();
  const { headers, rows } = parseCsv(fileContent);
  expect(headers).toEqual([
    'Contest',
    'Contest ID',
    'Selection',
    'Selection ID',
    'Total Votes',
  ]);

  const bestAnimalMammalExpectedValues: Record<string, string> = {
    horse: '4',
    otter: '4',
    fox: '36',
    overvotes: '8',
    undervotes: '4',
  };
  const bestAnimalMammalRows = rows.filter(
    (row) => row['Contest ID'] === 'best-animal-mammal'
  );
  expect(bestAnimalMammalRows).toHaveLength(5);
  for (const [selectionId, votes] of Object.entries(
    bestAnimalMammalExpectedValues
  )) {
    expect(votes).toEqual(bestAnimalMammalExpectedValues[selectionId]);
  }

  const fishingExpectedValues: Record<string, string> = {
    'ban-fishing': '8',
    'allow-fishing': '8',
    overvotes: '8',
    undervotes: '88',
  };
  const fishingRows = rows.filter((row) => row['Contest ID'] === 'fishing');
  expect(fishingRows).toHaveLength(4);
  for (const [selectionId, votes] of Object.entries(fishingExpectedValues)) {
    expect(votes).toEqual(fishingExpectedValues[selectionId]);
  }
});

it('logs failure if export fails for some reason', async () => {
  const { castVoteRecordExport } = electionTwoPartyPrimaryFixtures;
  const electionDefinition =
    electionTwoPartyPrimaryFixtures.electionJson.toElectionDefinition();

  const { api, auth, logger } = buildTestEnvironment();
  await configureMachine(api, auth, electionDefinition);
  mockElectionManagerAuth(auth, electionDefinition.election);

  const loadFileResult = await api.addCastVoteRecordFile({
    path: castVoteRecordExport.asDirectoryPath(),
  });
  loadFileResult.assertOk('load file failed');

  const offLimitsPath = '/root/hidden';
  const failedExportResult = await api.exportTallyReportCsv({
    filter: {},
    groupBy: {},
    path: offLimitsPath,
  });
  expect(failedExportResult.isErr()).toEqual(true);
  expect(logger.logAsCurrentRole).toHaveBeenLastCalledWith(
    LogEventId.FileSaved,
    {
      disposition: 'failure',
      filename: offLimitsPath,
      message: `Failed to save tally report CSV file to ${offLimitsPath} on the USB drive.`,
    }
  );
});

it('incorporates wia and manual data (grouping by voting method)', async () => {
  const { castVoteRecordExport } =
    electionGridLayoutNewHampshireTestBallotFixtures;
  const electionDefinition =
    electionGridLayoutNewHampshireTestBallotFixtures.electionJson.toElectionDefinition();
  const { election } = electionDefinition;

  const { api, auth } = buildTestEnvironment();
  await configureMachine(api, auth, electionDefinition);
  mockElectionManagerAuth(auth, electionDefinition.election);

  const loadFileResult = await api.addCastVoteRecordFile({
    path: castVoteRecordExport.asDirectoryPath(),
  });
  loadFileResult.assertOk('load file failed');

  const groupBy: Tabulation.GroupBy = {
    groupByVotingMethod: true,
  };
  const candidateContestId =
    'State-Representatives-Hillsborough-District-34-b1012d38';
  const officialCandidateId = 'Obadiah-Carrigan-5c95145a';
  const officialCandidateName = 'Obadiah Carrigan';

  function rowExists(
    rows: ReturnType<typeof parseCsv>['rows'],
    {
      selection,
      selectionId,
      votingMethod,
      totalVotes,
      scannedVotes,
      manualVotes,
    }: {
      selection: string;
      selectionId: string;
      votingMethod: string;
      totalVotes: number;
      scannedVotes?: number;
      manualVotes?: number;
    }
  ): boolean {
    return rows.some(
      (row) =>
        row['Selection'] === selection &&
        row['Selection ID'] === selectionId &&
        row['Voting Method'] === votingMethod &&
        row['Total Votes'] === totalVotes.toString() &&
        (!scannedVotes || row['Scanned Votes'] === scannedVotes.toString()) &&
        (!manualVotes || row['Manual Votes'] === manualVotes.toString())
    );
  }

  // check initial export, without wia and manual data
  const { headers: headersInitial, rows: rowsInitial } = await getParsedExport({
    api,
    filter: {},
    groupBy,
  });
  expect(headersInitial).toEqual([
    'Voting Method',
    'Contest',
    'Contest ID',
    'Selection',
    'Selection ID',
    'Total Votes',
  ]);

  // initial official candidate counts
  expect(
    rowExists(rowsInitial, {
      selection: officialCandidateName,
      selectionId: officialCandidateId,
      votingMethod: 'Precinct',
      totalVotes: 30,
    })
  ).toBeTruthy();
  expect(
    rowExists(rowsInitial, {
      selection: officialCandidateName,
      selectionId: officialCandidateId,
      votingMethod: 'Precinct',
      totalVotes: 30,
    })
  ).toBeTruthy();

  // initial generic write-in counts
  expect(
    rowExists(rowsInitial, {
      selection: Tabulation.PENDING_WRITE_IN_NAME,
      selectionId: Tabulation.PENDING_WRITE_IN_ID,
      votingMethod: 'Precinct',
      totalVotes: 28,
    })
  ).toBeTruthy();
  expect(
    rowExists(rowsInitial, {
      selection: Tabulation.PENDING_WRITE_IN_NAME,
      selectionId: Tabulation.PENDING_WRITE_IN_ID,
      votingMethod: 'Absentee',
      totalVotes: 28,
    })
  ).toBeTruthy();

  // adjudicate write-ins for unofficial candidate
  const writeInCandidate = api.addWriteInCandidate({
    contestId: candidateContestId,
    name: 'Mr. Pickles',
  });
  const writeInIds = api.getWriteInAdjudicationQueue({
    contestId: candidateContestId,
  });
  for (const writeInId of writeInIds) {
    api.adjudicateWriteIn({
      writeInId,
      type: 'write-in-candidate',
      candidateId: writeInCandidate.id,
    });
  }

  // add manual data
  const manualOnlyWriteInCandidate = api.addWriteInCandidate({
    contestId: candidateContestId,
    name: 'Ms. Bean',
  });
  await api.setManualResults({
    precinctId: election.precincts[0]!.id,
    votingMethod: 'absentee',
    ballotStyleGroupId: election.ballotStyles[0]!.groupId,
    manualResults: buildManualResultsFixture({
      election,
      ballotCount: 20,
      contestResultsSummaries: {
        [candidateContestId]: {
          type: 'candidate',
          ballots: 20,
          overvotes: 0,
          undervotes: 0,
          officialOptionTallies: {
            [officialCandidateId]: 10,
          },
          writeInOptionTallies: {
            [writeInCandidate.id]: {
              name: writeInCandidate.name,
              tally: 5,
            },
            [manualOnlyWriteInCandidate.id]: {
              name: manualOnlyWriteInCandidate.name,
              tally: 5,
            },
          },
        },
      },
    }),
  });

  // check final export, with wia and manual data
  const { headers: headersFinal, rows: rowsFinal } = await getParsedExport({
    api,
    filter: {},
    groupBy,
  });
  expect(headersFinal).toEqual([
    'Voting Method',
    'Contest',
    'Contest ID',
    'Selection',
    'Selection ID',
    'Manual Votes',
    'Scanned Votes',
    'Total Votes',
  ]);

  // final official candidate counts
  expect(
    rowExists(rowsFinal, {
      selection: officialCandidateName,
      selectionId: officialCandidateId,
      votingMethod: 'Precinct',
      manualVotes: 0,
      scannedVotes: 30,
      totalVotes: 30,
    })
  ).toBeTruthy();
  expect(
    rowExists(rowsFinal, {
      selection: officialCandidateName,
      selectionId: officialCandidateId,
      votingMethod: 'Absentee',
      manualVotes: 10,
      scannedVotes: 30,
      totalVotes: 40,
    })
  ).toBeTruthy(); // manual data reflected

  // adjudicated write-in candidate counts
  expect(
    rowExists(rowsFinal, {
      selection: `${writeInCandidate.name} (Write-In)`,
      selectionId: writeInCandidate.id,
      votingMethod: 'Precinct',
      manualVotes: 0,
      scannedVotes: 28,
      totalVotes: 28,
    })
  ).toBeTruthy();
  expect(
    rowExists(rowsFinal, {
      selection: `${writeInCandidate.name} (Write-In)`,
      selectionId: writeInCandidate.id,
      votingMethod: 'Absentee',
      manualVotes: 5,
      scannedVotes: 28,
      totalVotes: 33,
    })
  ).toBeTruthy();

  // manual-only write-in candidate counts
  expect(
    rowExists(rowsFinal, {
      selection: `${manualOnlyWriteInCandidate.name} (Write-In)`,
      selectionId: manualOnlyWriteInCandidate.id,
      votingMethod: 'Absentee',
      manualVotes: 5,
      scannedVotes: 0,
      totalVotes: 5,
    })
  ).toBeTruthy();

  // pending write-in counts should be gone
  expect(
    rowsFinal.some(
      (r) =>
        r['Contest ID'] === candidateContestId &&
        r['Selection ID'] === Tabulation.PENDING_WRITE_IN_ID
    )
  ).toBeFalsy();
});

it('exports ballot styles grouped by language agnostic parent in multi-language elections', async () => {
  const { castVoteRecordExport } = electionPrimaryPrecinctSplitsFixtures;
  const electionDefinition =
    electionPrimaryPrecinctSplitsFixtures.electionJson.toElectionDefinition();

  const { api, auth, logger } = buildTestEnvironment();
  await configureMachine(api, auth, electionDefinition);
  mockElectionManagerAuth(auth, electionDefinition.election);

  const loadFileResult = await api.addCastVoteRecordFile({
    path: castVoteRecordExport.asDirectoryPath(),
  });
  console.warn(loadFileResult);
  loadFileResult.assertOk('load file failed');

  const path = tmpNameSync();
  const exportResult = await api.exportTallyReportCsv({
    filter: {},
    groupBy: { groupByBallotStyle: true },
    path,
  });
  expect(exportResult.isOk()).toEqual(true);
  expect(logger.logAsCurrentRole).toHaveBeenLastCalledWith(
    LogEventId.FileSaved,
    {
      disposition: 'success',
      filename: path,
      message: `Saved tally report CSV file to ${path} on the USB drive.`,
    }
  );

  const fileContent = readFileSync(path, 'utf-8').toString();
  const { headers, rows } = parseCsv(fileContent);
  expect(headers).toEqual([
    'Party',
    'Party ID',
    'Ballot Style ID',
    'Contest',
    'Contest ID',
    'Selection',
    'Selection ID',
    'Total Votes',
  ]);
  const ballotStyle1MaRows = rows.filter(
    (row) => row['Ballot Style ID'] === '1-Ma'
  );
  const ballotStyle4MaRows = rows.filter(
    (row) => row['Ballot Style ID'] === '4-Ma'
  );
  const ballotStyle4fRows = rows.filter(
    (row) => row['Ballot Style ID'] === '4-F'
  );
  expect(ballotStyle1MaRows).toHaveLength(16);
  expect(ballotStyle4MaRows).toHaveLength(16);
  expect(ballotStyle4fRows).toHaveLength(15);
});
