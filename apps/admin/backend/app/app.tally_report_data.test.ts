jest.mock('@vx/libs/utils/src', () => {
  return {
    ...jest.requireActual('@vx/libs/utils/src'),
    isFeatureFlagEnabled: (flag: BooleanEnvironmentVariableName) =>
      featureFlagMock.isEnabled(flag),
  };
});

jest.mock(
  '@vx/libs/backend/diagnostics',
  (): typeof import('@vx/libs/backend/diagnostics') => ({
    ...jest.requireActual('@vx/libs/backend/diagnostics'),
    initializeGetWorkspaceDiskSpaceSummary: jest.fn(),
  })
);

import * as electionGridLayoutNewHampshireTestBallotFixtures from '@vx/libs/fixtures/src/data/electionGridLayoutNewHampshireTestBallot';
import * as electionPrimaryPrecinctSplitsFixtures from '@vx/libs/fixtures/src/data/electionPrimaryPrecinctSplits';
import * as electionTwoPartyPrimaryFixtures from '@vx/libs/fixtures/src/data/electionTwoPartyPrimary';
import {
  BooleanEnvironmentVariableName,
  getFeatureFlagMock,
} from '@vx/libs/utils/src';
import { buildManualResultsFixture } from '@vx/libs/utils/src/tabulation';
import { assert } from '@vx/libs/basics/assert';
import { find } from '@vx/libs/basics/collections';
import { type BallotStyleGroupId } from '@vx/libs/types/elections';
import { Tabulation } from '@vx/libs/types/tabulation';
import { initializeGetWorkspaceDiskSpaceSummary } from '@vx/libs/backend/diagnostics';
import { mockOf } from '@vx/libs/test-utils/src';
import {
  buildTestEnvironment,
  configureMachine,
  mockElectionManagerAuth,
} from '../test/app';

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
  mockOf(initializeGetWorkspaceDiskSpaceSummary).mockReturnValue(() =>
    Promise.resolve({
      total: 10 * 1_000_000,
      used: 1 * 1_000_000,
      available: 9 * 1_000_000,
    })
  );
});

afterEach(() => {
  featureFlagMock.resetFeatureFlags();
});

test('general, full election, write in adjudication', async () => {
  const { castVoteRecordExport } =
    electionGridLayoutNewHampshireTestBallotFixtures;
  const electionDefinition =
    electionGridLayoutNewHampshireTestBallotFixtures.electionJson.toElectionDefinition();

  const { api, auth } = buildTestEnvironment();
  await configureMachine(api, auth, electionDefinition);
  mockElectionManagerAuth(auth, electionDefinition.election);

  const loadFileResult = await api.addCastVoteRecordFile({
    path: castVoteRecordExport.asDirectoryPath(),
  });
  loadFileResult.assertOk('load file failed');

  const writeInContestId =
    'State-Representatives-Hillsborough-District-34-b1012d38';
  const officialCandidateId = 'Obadiah-Carrigan-5c95145a';

  // check results before any write-in adjudication
  const fullElectionTallyReportList = await api.getResultsForTallyReports();
  expect(fullElectionTallyReportList).toHaveLength(1);
  const [fullElectionTallyReport] = fullElectionTallyReportList;
  assert(fullElectionTallyReport);
  assert(!fullElectionTallyReport.hasPartySplits);

  expect(fullElectionTallyReport.contestIds).toEqual(
    electionDefinition.election.contests.map((c) => c.id)
  );
  expect(fullElectionTallyReport.manualResults).toBeUndefined();
  expect(fullElectionTallyReport.cardCounts).toEqual({
    bmd: 0,
    hmpb: [184],
  });
  expect(
    fullElectionTallyReport.scannedResults.contestResults[writeInContestId]
  ).toMatchObject({
    ballots: 184,
    undervotes: 12,
    tallies: {
      'Obadiah-Carrigan-5c95145a': {
        id: 'Obadiah-Carrigan-5c95145a',
        name: 'Obadiah Carrigan',
        tally: 60,
      },
      [Tabulation.PENDING_WRITE_IN_ID]: {
        ...Tabulation.PENDING_WRITE_IN_CANDIDATE,
        tally: 56,
      },
    },
  });

  // adjudicate some write-ins
  const unofficialCandidate = api.addWriteInCandidate({
    contestId: writeInContestId,
    name: 'Unofficial Candidate',
  });
  const writeInIds = api.getWriteInAdjudicationQueue({
    contestId: writeInContestId,
  });
  expect(writeInIds).toHaveLength(56);
  const NUM_INVALID = 24;
  const NUM_OFFICIAL = 16;
  const NUM_UNOFFICIAL = 56 - NUM_INVALID - NUM_OFFICIAL;
  for (const [i, writeInId] of writeInIds.entries()) {
    if (i < NUM_INVALID) {
      api.adjudicateWriteIn({
        writeInId,
        type: 'invalid',
      });
    } else if (i < NUM_INVALID + NUM_OFFICIAL) {
      api.adjudicateWriteIn({
        writeInId,
        type: 'official-candidate',
        candidateId: officialCandidateId,
      });
    } else {
      api.adjudicateWriteIn({
        writeInId,
        type: 'write-in-candidate',
        candidateId: unofficialCandidate.id,
      });
    }
  }

  const wiaFullElectionTallyReportList = await api.getResultsForTallyReports();
  expect(wiaFullElectionTallyReportList).toHaveLength(1);
  const [wiaFullElectionTallyReport] = wiaFullElectionTallyReportList;
  assert(wiaFullElectionTallyReport);
  assert(!wiaFullElectionTallyReport.hasPartySplits);

  expect(wiaFullElectionTallyReport.manualResults).toBeUndefined();
  expect(wiaFullElectionTallyReport.cardCounts).toMatchObject({
    bmd: 0,
    hmpb: [184],
  });
  expect(
    wiaFullElectionTallyReport.scannedResults.contestResults[writeInContestId]
  ).toMatchObject({
    ballots: 184,
    undervotes: 12 + NUM_INVALID,
    tallies: {
      'Obadiah-Carrigan-5c95145a': {
        id: 'Obadiah-Carrigan-5c95145a',
        name: 'Obadiah Carrigan',
        tally: 60 + NUM_OFFICIAL,
      },
      [unofficialCandidate.id]: {
        id: unofficialCandidate.id,
        isWriteIn: true,
        name: unofficialCandidate.name,
        tally: NUM_UNOFFICIAL,
      },
    },
  });
});

test('general, reports by voting method, manual data', async () => {
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

  const writeInContestId =
    'State-Representatives-Hillsborough-District-34-b1012d38';

  // add unofficial candidate for manual results to reference
  const unofficialCandidate = api.addWriteInCandidate({
    contestId: writeInContestId,
    name: 'Unofficial Candidate',
  });

  // add manual results
  const absenteeManualResults = buildManualResultsFixture({
    election,
    ballotCount: 10,
    contestResultsSummaries: {
      [writeInContestId]: {
        type: 'candidate',
        ballots: 10,
        writeInOptionTallies: {
          [unofficialCandidate.id]: {
            tally: 10,
            name: unofficialCandidate.name,
          },
        },
      },
    },
  });
  await api.setManualResults({
    precinctId: election.precincts[0]!.id,
    ballotStyleGroupId: election.ballotStyles[0]!.groupId,
    votingMethod: 'absentee',
    manualResults: absenteeManualResults,
  });

  // Case 1: incorporating manual results alongside scanned results
  const votingMethodTallyReportList = await api.getResultsForTallyReports({
    filter: {},
    groupBy: { groupByVotingMethod: true },
  });
  expect(votingMethodTallyReportList).toHaveLength(2);
  const absenteeTallyReport = find(
    votingMethodTallyReportList,
    (report) => report.votingMethod === 'absentee'
  );
  const precinctTallyReport = find(
    votingMethodTallyReportList,
    (report) => report.votingMethod === 'precinct'
  );
  assert(!absenteeTallyReport.hasPartySplits);
  assert(!precinctTallyReport.hasPartySplits);

  // all contests should be included as voting method doesn't exclude any contests
  expect(absenteeTallyReport.contestIds).toEqual(
    electionDefinition.election.contests.map((c) => c.id)
  );

  // scanned results should be the same
  expect(absenteeTallyReport.scannedResults).toEqual(
    precinctTallyReport.scannedResults
  );

  // card counts should be different on account of manual results
  expect(absenteeTallyReport.cardCounts).toEqual({
    bmd: 0,
    hmpb: [92],
    manual: 10,
  });
  expect(precinctTallyReport.cardCounts).toEqual({
    bmd: 0,
    hmpb: [92],
  });

  expect(precinctTallyReport.manualResults).toBeUndefined();
  const receivedAbsenteeManualResults = absenteeTallyReport.manualResults;
  expect(receivedAbsenteeManualResults).toBeDefined();
  expect(receivedAbsenteeManualResults).toMatchObject(absenteeManualResults);

  // Case 2: ignoring manual results due to filter
  const scannerFilteredTallyReportResult = await api.getResultsForTallyReports({
    filter: { scannerIds: ['VX-00-000'] },
    groupBy: { groupByVotingMethod: true },
  });
  expect(scannerFilteredTallyReportResult).toHaveLength(2);
  const scannerAbsenteeTallyReport = find(
    scannerFilteredTallyReportResult,
    (report) => report.votingMethod === 'absentee'
  );

  expect(scannerAbsenteeTallyReport.scannedResults).toEqual(
    absenteeTallyReport.scannedResults
  );
  expect(scannerAbsenteeTallyReport.manualResults).toBeUndefined();

  // Case 3: incorporating manual results as separate reports due to grouping
  const batchGroupedTallyReportResult = await api.getResultsForTallyReports({
    filter: {},
    groupBy: { groupByBatch: true, groupByVotingMethod: true },
  });
  expect(batchGroupedTallyReportResult).toMatchObject(
    expect.arrayContaining([
      expect.objectContaining({
        batchId: expect.anything(),
        votingMethod: 'precinct',
      }),
      expect.objectContaining({
        batchId: expect.anything(),
        votingMethod: 'absentee',
      }),
      expect.objectContaining({
        batchId: Tabulation.MANUAL_BATCH_ID,
        votingMethod: 'absentee',
        manualResults: expect.anything(),
      }),
    ])
  );
});

test('primary, full election', async () => {
  const { castVoteRecordExport } = electionTwoPartyPrimaryFixtures;
  const electionDefinition =
    electionTwoPartyPrimaryFixtures.electionJson.toElectionDefinition();
  const { election } = electionDefinition;

  const { api, auth } = buildTestEnvironment();
  await configureMachine(api, auth, electionDefinition);
  mockElectionManagerAuth(auth, electionDefinition.election);

  const loadFileResult = await api.addCastVoteRecordFile({
    path: castVoteRecordExport.asDirectoryPath(),
  });
  loadFileResult.assertOk('load file failed');

  const fullElectionTallyReportList = await api.getResultsForTallyReports();
  expect(fullElectionTallyReportList).toHaveLength(1);
  const [fullElectionTallyReport] = fullElectionTallyReportList;
  assert(fullElectionTallyReport);
  assert(fullElectionTallyReport.hasPartySplits);

  // should contain all contests, as filtering contests by party is the frontend's responsibility
  expect(fullElectionTallyReport.contestIds).toEqual(
    election.contests.map((c) => c.id)
  );

  // should have card counts by party as needed for the report display
  expect(fullElectionTallyReport.cardCountsByParty).toEqual({
    '0': {
      bmd: 56,
      hmpb: [],
    },
    '1': {
      bmd: 56,
      hmpb: [],
    },
  });

  expect(fullElectionTallyReport.scannedResults.cardCounts).toEqual({
    bmd: 112,
    hmpb: [],
    manual: 0,
  });

  // check one contest for sanity
  expect(
    fullElectionTallyReport.scannedResults.contestResults['fishing']
  ).toEqual({
    ballots: 112,
    contestId: 'fishing',
    contestType: 'yesno',
    yesOptionId: 'ban-fishing',
    noOptionId: 'allow-fishing',
    noTally: 8,
    overvotes: 8,
    undervotes: 88,
    yesTally: 8,
  });

  // no manual results
  expect(fullElectionTallyReport.manualResults).toBeUndefined();
});

test('primary, full election, with manual results', async () => {
  const { castVoteRecordExport } = electionTwoPartyPrimaryFixtures;
  const electionDefinition =
    electionTwoPartyPrimaryFixtures.electionJson.toElectionDefinition();
  const { election } = electionDefinition;

  const { api, auth } = buildTestEnvironment();
  await configureMachine(api, auth, electionDefinition);
  mockElectionManagerAuth(auth, electionDefinition.election);

  const loadFileResult = await api.addCastVoteRecordFile({
    path: castVoteRecordExport.asDirectoryPath(),
  });
  loadFileResult.assertOk('load file failed');

  // add some manual results for a single ballot style, representing only one party
  await api.setManualResults({
    precinctId: 'precinct-1',
    ballotStyleGroupId: '1M' as BallotStyleGroupId,
    votingMethod: 'absentee',
    manualResults: buildManualResultsFixture({
      election,
      ballotCount: 10,
      contestResultsSummaries: {},
    }),
  });

  const fullElectionTallyReportList = await api.getResultsForTallyReports();
  expect(fullElectionTallyReportList).toHaveLength(1);
  const [fullElectionTallyReport] = fullElectionTallyReportList;
  assert(fullElectionTallyReport);
  assert(fullElectionTallyReport.hasPartySplits);

  // manual results should affect only the parties their ballot styles represent
  expect(fullElectionTallyReport.cardCountsByParty).toEqual({
    '0': {
      bmd: 56,
      hmpb: [],
      manual: 10,
    },
    '1': {
      bmd: 56,
      hmpb: [],
    },
  });

  expect(fullElectionTallyReport.scannedResults.cardCounts).toEqual({
    bmd: 112,
    hmpb: [],
    manual: 0,
  });

  expect(fullElectionTallyReport.manualResults?.ballotCount).toEqual(10);
});

test('single language primary, reports by ballot style', async () => {
  const { castVoteRecordExport } = electionTwoPartyPrimaryFixtures;
  const electionDefinition =
    electionTwoPartyPrimaryFixtures.electionJson.toElectionDefinition();

  const { api, auth } = buildTestEnvironment();
  await configureMachine(api, auth, electionDefinition);
  mockElectionManagerAuth(auth, electionDefinition.election);

  const loadFileResult = await api.addCastVoteRecordFile({
    path: castVoteRecordExport.asDirectoryPath(),
  });
  loadFileResult.assertOk('load file failed');

  const ballotStyleTallyReportList = await api.getResultsForTallyReports({
    filter: {},
    groupBy: { groupByBallotStyle: true },
  });
  expect(ballotStyleTallyReportList).toHaveLength(2);
  const mammalBallotStyleTallyReport = find(
    ballotStyleTallyReportList,
    (report) => report.ballotStyleGroupId === '1M'
  );
  const fishBallotStyleTallyReport = find(
    ballotStyleTallyReportList,
    (report) => report.ballotStyleGroupId === '2F'
  );
  assert(mammalBallotStyleTallyReport.hasPartySplits);
  assert(fishBallotStyleTallyReport.hasPartySplits);

  // card counts should reflect the fact that each report only represents one party
  expect(mammalBallotStyleTallyReport.cardCountsByParty).toEqual({
    '0': {
      bmd: 56,
      hmpb: [],
    },
  });
  expect(fishBallotStyleTallyReport.cardCountsByParty).toEqual({
    '1': {
      bmd: 56,
      hmpb: [],
    },
  });

  // contest lists should be different
  expect(mammalBallotStyleTallyReport.contestIds).toEqual([
    'best-animal-mammal',
    'zoo-council-mammal',
    'new-zoo-either',
    'new-zoo-pick',
    'fishing',
  ]);
  expect(fishBallotStyleTallyReport.contestIds).toEqual([
    'best-animal-fish',
    'aquarium-council-fish',
    'new-zoo-either',
    'new-zoo-pick',
    'fishing',
  ]);
});

test('multi language, filtered by ballot style - grouped by precinct ', async () => {
  const { castVoteRecordExport } = electionPrimaryPrecinctSplitsFixtures;
  const electionDefinition =
    electionPrimaryPrecinctSplitsFixtures.electionJson.toElectionDefinition();

  const { api, auth } = buildTestEnvironment();
  await configureMachine(api, auth, electionDefinition);
  mockElectionManagerAuth(auth, electionDefinition.election);

  const loadFileResult = await api.addCastVoteRecordFile({
    path: castVoteRecordExport.asDirectoryPath(),
  });
  loadFileResult.assertOk('load file failed');

  const precinctTallyReportList = await api.getResultsForTallyReports({
    filter: {
      ballotStyleGroupIds: ['1-Ma', '4-F'] as BallotStyleGroupId[],
    },
    groupBy: { groupByPrecinct: true },
  });
  expect(precinctTallyReportList).toHaveLength(3);

  const congressional1split1 = precinctTallyReportList.find(
    (r) => r.precinctId === 'precinct-c1-w1-1'
  );
  assert(congressional1split1);
  assert(congressional1split1.hasPartySplits);

  const congressional1split2 = precinctTallyReportList.find(
    (r) => r.precinctId === 'precinct-c1-w1-1'
  );
  assert(congressional1split2);
  assert(congressional1split2.hasPartySplits);

  const congressional2 = precinctTallyReportList.find(
    (r) => r.precinctId === 'precinct-c2'
  );
  assert(congressional2);
  assert(congressional2.hasPartySplits);

  expect(congressional1split1.cardCountsByParty).toEqual({
    '0': {
      bmd: 72,
      hmpb: [],
    },
  });
  expect(congressional1split2.cardCountsByParty).toEqual({
    '0': {
      bmd: 72,
      hmpb: [],
    },
  });
  expect(congressional2.cardCountsByParty).toEqual({
    '1': {
      bmd: 72,
      hmpb: [],
    },
  });
});

test('multi language, filtered by party - grouped by ballot style ', async () => {
  const { castVoteRecordExport } = electionPrimaryPrecinctSplitsFixtures;
  const electionDefinition =
    electionPrimaryPrecinctSplitsFixtures.electionJson.toElectionDefinition();

  const { api, auth } = buildTestEnvironment();
  await configureMachine(api, auth, electionDefinition);
  mockElectionManagerAuth(auth, electionDefinition.election);

  const loadFileResult = await api.addCastVoteRecordFile({
    path: castVoteRecordExport.asDirectoryPath(),
  });
  loadFileResult.assertOk('load file failed');

  const precinctTallyReportList = await api.getResultsForTallyReports({
    filter: { partyIds: ['0'] },
    groupBy: { groupByBallotStyle: true },
  });
  expect(precinctTallyReportList).toHaveLength(4);

  expect(
    precinctTallyReportList.map((report) => report.ballotStyleGroupId)
  ).toEqual(['1-Ma', '2-Ma', '3-Ma', '4-Ma']);
  for (const report of precinctTallyReportList) {
    assert(report.hasPartySplits);
    expect(report.cardCountsByParty).toEqual({
      '0': {
        bmd: report.ballotStyleGroupId === '1-Ma' ? 144 : 72,
        hmpb: [],
      },
    });
  }
});

test('multi language, reports by ballot style - agnostic to language specific ballot style ', async () => {
  const { castVoteRecordExport } = electionPrimaryPrecinctSplitsFixtures;
  const electionDefinition =
    electionPrimaryPrecinctSplitsFixtures.electionJson.toElectionDefinition();

  const { api, auth } = buildTestEnvironment();
  await configureMachine(api, auth, electionDefinition);
  mockElectionManagerAuth(auth, electionDefinition.election);

  const loadFileResult = await api.addCastVoteRecordFile({
    path: castVoteRecordExport.asDirectoryPath(),
  });
  loadFileResult.assertOk('load file failed');

  const ballotStyleTallyReportList = await api.getResultsForTallyReports({
    filter: {},
    groupBy: { groupByBallotStyle: true },
  });
  expect(electionDefinition.election.ballotStyles).toHaveLength(8 * 4);
  expect(ballotStyleTallyReportList).toHaveLength(8);

  // We don't need to inspect the results for all 8 ballot styles, chose one for each party.
  const firstMammalTallyReport = find(
    ballotStyleTallyReportList,
    (report) => report.ballotStyleGroupId === '1-Ma'
  );
  const fourthFishTallyReport = find(
    ballotStyleTallyReportList,
    (report) => report.ballotStyleGroupId === '4-F'
  );
  assert(firstMammalTallyReport.hasPartySplits);
  assert(fourthFishTallyReport.hasPartySplits);
  expect(firstMammalTallyReport.cardCountsByParty).toEqual({
    '0': {
      bmd: 144,
      hmpb: [],
    },
  });
  expect(fourthFishTallyReport.cardCountsByParty).toEqual({
    '1': {
      bmd: 72,
      hmpb: [],
    },
  });
  // contest lists should be different
  expect(firstMammalTallyReport.contestIds).toEqual([
    'county-leader-mammal',
    'congressional-1-mammal',
    'water-1-fishing',
  ]);
  expect(fourthFishTallyReport.contestIds).toEqual([
    'county-leader-fish',
    'congressional-2-fish',
    'water-2-fishing',
  ]);
});

test('primary, reports grouped by voting method, filtered by precinct', async () => {
  const { castVoteRecordExport } = electionTwoPartyPrimaryFixtures;
  const electionDefinition =
    electionTwoPartyPrimaryFixtures.electionJson.toElectionDefinition();

  const { api, auth } = buildTestEnvironment();
  await configureMachine(api, auth, electionDefinition);
  mockElectionManagerAuth(auth, electionDefinition.election);

  const loadFileResult = await api.addCastVoteRecordFile({
    path: castVoteRecordExport.asDirectoryPath(),
  });
  loadFileResult.assertOk('load file failed');

  const tallyReportList = await api.getResultsForTallyReports({
    groupBy: { groupByVotingMethod: true },
    filter: { precinctIds: ['precinct-1'] },
  });
  expect(tallyReportList).toHaveLength(2);
  const absenteeTallyReport = find(
    tallyReportList,
    (report) => report.votingMethod === 'absentee'
  );
  const precinctTallyReport = find(
    tallyReportList,
    (report) => report.votingMethod === 'precinct'
  );
  assert(absenteeTallyReport.hasPartySplits);
  assert(precinctTallyReport.hasPartySplits);

  // ballot counts should indicate that only one precinct is included
  expect(absenteeTallyReport.cardCountsByParty).toEqual({
    '0': {
      bmd: 14,
      hmpb: [],
    },
    '1': {
      bmd: 14,
      hmpb: [],
    },
  });
  expect(precinctTallyReport.cardCountsByParty).toEqual(
    absenteeTallyReport.cardCountsByParty
  );
});
