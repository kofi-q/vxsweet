jest.mock('@vx/libs/utils/src', () => {
  return {
    ...jest.requireActual('@vx/libs/utils/src'),
    isFeatureFlagEnabled: (flag: BooleanEnvironmentVariableName) =>
      featureFlagMock.isEnabled(flag),
  };
});

import {
  electionGridLayoutNewHampshireTestBallotFixtures,
  electionTwoPartyPrimaryFixtures,
} from '@vx/libs/fixtures/src';
import { assert } from '@vx/libs/basics/assert';
import { find } from '@vx/libs/basics/collections';
import { typedAs } from '@vx/libs/basics/types';
import { toDataUrl, loadImageData } from '@vx/libs/image-utils/src';
import { join } from 'node:path';
import {
  BooleanEnvironmentVariableName,
  UNMARKED_WRITE_IN_SELECTION_POSITION_OTHER_STATUS,
  getFeatureFlagMock,
} from '@vx/libs/utils/src';
import {
  type ContestResultsSummary,
  buildElectionResultsFixture,
} from '@vx/libs/utils/src/tabulation';
import { CVR } from '@vx/libs/types/cdf';
import { type Id } from '@vx/libs/types/basic';
import { type Rect } from '@vx/libs/types/geometry';
import { Tabulation } from '@vx/libs/types/tabulation';
import { modifyCastVoteRecordExport } from '@vx/libs/backend/cast_vote_records';
import {
  buildTestEnvironment,
  configureMachine,
  mockElectionManagerAuth,
} from '../test/app';
import {
  type BmdWriteInImageView,
  type HmpbWriteInImageView,
  type WriteInAdjudicationContext,
  type WriteInRecord,
} from '../types/types';

jest.setTimeout(30_000);

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

test('getWriteInAdjudicationQueue', async () => {
  const { auth, api } = buildTestEnvironment();
  const { electionDefinition, castVoteRecordExport } =
    electionGridLayoutNewHampshireTestBallotFixtures;
  await configureMachine(api, auth, electionDefinition);

  (
    await api.addCastVoteRecordFile({
      path: castVoteRecordExport.asDirectoryPath(),
    })
  ).unsafeUnwrap();

  const allWriteIns = api.getWriteInAdjudicationQueue();
  expect(allWriteIns).toHaveLength(80);

  expect(
    api.getWriteInAdjudicationQueue({
      contestId: 'Sheriff-4243fe0b',
    })
  ).toHaveLength(2);

  // add another file, whose write-ins should end up at the end of the queue
  const secondReportPath = await modifyCastVoteRecordExport(
    castVoteRecordExport.asDirectoryPath(),
    {
      castVoteRecordModifier: (castVoteRecord) => ({
        ...castVoteRecord,
        UniqueId: `x-${castVoteRecord.UniqueId}`,
      }),
    }
  );
  (
    await api.addCastVoteRecordFile({
      path: secondReportPath,
    })
  ).unsafeUnwrap();

  const allWriteInsDouble = api.getWriteInAdjudicationQueue();
  expect(allWriteInsDouble).toHaveLength(160);
  expect(allWriteInsDouble.slice(0, 80)).toEqual(allWriteIns);
});

test('getWriteInAdjudicationQueueMetadata', async () => {
  const { auth, api } = buildTestEnvironment();
  const { electionDefinition, castVoteRecordExport } =
    electionGridLayoutNewHampshireTestBallotFixtures;
  await configureMachine(api, auth, electionDefinition);

  (
    await api.addCastVoteRecordFile({
      path: castVoteRecordExport.asDirectoryPath(),
    })
  ).unsafeUnwrap();

  const contestsWithWriteIns = electionDefinition.election.contests.filter(
    (contest) => contest.type === 'candidate' && contest.allowWriteIns
  );

  const allQueueMetadata = api.getWriteInAdjudicationQueueMetadata();
  expect(allQueueMetadata).toHaveLength(contestsWithWriteIns.length);
  assert(
    allQueueMetadata.every(
      (metadata) => metadata.totalTally === metadata.pendingTally
    )
  );

  expect(
    api.getWriteInAdjudicationQueueMetadata({
      contestId: 'Sheriff-4243fe0b',
    })
  ).toEqual([
    {
      contestId: 'Sheriff-4243fe0b',
      totalTally: 2,
      pendingTally: 2,
    },
  ]);
});

test('getWriteInAdjudicationContext', async () => {
  const { auth, api } = buildTestEnvironment();
  const { electionDefinition, manualCastVoteRecordExport } =
    electionGridLayoutNewHampshireTestBallotFixtures;
  await configureMachine(api, auth, electionDefinition);

  const reportDirectoryPath = manualCastVoteRecordExport.asDirectoryPath();
  (
    await api.addCastVoteRecordFile({
      path: reportDirectoryPath,
    })
  ).unsafeUnwrap();

  // look at a contest that can have multiple write-ins per ballot
  const contestId = 'State-Representatives-Hillsborough-District-34-b1012d38';
  const writeInIds = api.getWriteInAdjudicationQueue({
    contestId,
  });
  expect(writeInIds).toHaveLength(2);

  const [writeInIdA, writeInIdB] = writeInIds;
  assert(writeInIdA !== undefined && writeInIdB !== undefined);

  // check image of first write-in
  const writeInImageViewA = await api.getWriteInImageView({
    writeInId: writeInIdA,
  });
  assert(writeInImageViewA);

  const writeInAdjudicationContextA = api.getWriteInAdjudicationContext({
    writeInId: writeInIdA,
  });
  assert(writeInAdjudicationContextA);

  expect(writeInAdjudicationContextA).toMatchObject(
    typedAs<Partial<WriteInAdjudicationContext>>({
      cvrVotes: expect.objectContaining({
        [contestId]: expect.arrayContaining(['Obadiah-Carrigan-5c95145a']),
      }),
      relatedWriteIns: [
        expect.objectContaining(
          typedAs<Partial<WriteInRecord>>({
            status: 'pending',
          })
        ),
      ],
    })
  );

  // adjudicate first write-in for an official candidate
  api.adjudicateWriteIn({
    writeInId: writeInIdA,
    type: 'official-candidate',
    candidateId: 'Mary-Baker-Eddy-350785d5',
  });

  // check the second write-in detail view, which should show the just-adjudicated write-in
  const writeInAdjudicationContextB1 = api.getWriteInAdjudicationContext({
    writeInId: writeInIdB,
  });

  expect(writeInAdjudicationContextB1).toMatchObject(
    typedAs<Partial<WriteInAdjudicationContext>>({
      cvrVotes: expect.objectContaining({
        [contestId]: expect.arrayContaining(['Obadiah-Carrigan-5c95145a']),
      }),
      relatedWriteIns: [
        expect.objectContaining(
          typedAs<Partial<WriteInRecord>>({
            status: 'adjudicated',
            adjudicationType: 'official-candidate',
            candidateId: 'Mary-Baker-Eddy-350785d5',
          })
        ),
      ],
    })
  );

  // re-adjudicate the first write-in for a write-in candidate and expect the ids to change
  const { id: writeInCandidateId } = api.addWriteInCandidate({
    contestId,
    name: 'Bob Hope',
  });
  api.adjudicateWriteIn({
    writeInId: writeInIdA,
    type: 'write-in-candidate',
    candidateId: writeInCandidateId,
  });
  const writeInAdjudicationContextB2 = api.getWriteInAdjudicationContext({
    writeInId: writeInIdB,
  });

  expect(writeInAdjudicationContextB2).toMatchObject(
    typedAs<Partial<WriteInAdjudicationContext>>({
      cvrVotes: expect.objectContaining({
        [contestId]: expect.arrayContaining(['Obadiah-Carrigan-5c95145a']),
      }),
      relatedWriteIns: [
        expect.objectContaining(
          typedAs<Partial<WriteInRecord>>({
            status: 'adjudicated',
            adjudicationType: 'write-in-candidate',
            candidateId: writeInCandidateId,
          })
        ),
      ],
    })
  );
});

test('getWriteInImageView on hmpb', async () => {
  const { auth, api } = buildTestEnvironment();
  const { electionDefinition, manualCastVoteRecordExport } =
    electionGridLayoutNewHampshireTestBallotFixtures;
  await configureMachine(api, auth, electionDefinition);

  const reportDirectoryPath = manualCastVoteRecordExport.asDirectoryPath();
  (
    await api.addCastVoteRecordFile({
      path: reportDirectoryPath,
    })
  ).unsafeUnwrap();

  // look at a contest that can have multiple write-ins per ballot
  const contestId = 'State-Representatives-Hillsborough-District-34-b1012d38';
  const writeInIds = api.getWriteInAdjudicationQueue({
    contestId,
  });
  expect(writeInIds).toHaveLength(2);

  const [writeInIdA, writeInIdB] = writeInIds;
  assert(writeInIdA !== undefined && writeInIdB !== undefined);

  // check image of first write-in
  const writeInImageViewA = await api.getWriteInImageView({
    writeInId: writeInIdA,
  });
  assert(writeInImageViewA);

  const {
    imageUrl: actualImageUrl,
    ballotCoordinates: ballotCoordinatesA,
    contestCoordinates: contestCoordinatesA,
    writeInCoordinates: writeInCoordinatesA,
  } = writeInImageViewA as HmpbWriteInImageView;

  const expectedImage = await loadImageData(
    join(
      reportDirectoryPath,
      '864a2854-ee26-4223-8097-9633b7bed096',
      '864a2854-ee26-4223-8097-9633b7bed096-front.jpg'
    )
  );
  const expectedImageUrl = toDataUrl(expectedImage, 'image/jpeg');
  expect(actualImageUrl).toEqual(expectedImageUrl);

  const expectedBallotCoordinates: Rect = {
    height: expectedImage.height,
    width: expectedImage.width,
    x: 0,
    y: 0,
  };
  expect(ballotCoordinatesA).toEqual(expectedBallotCoordinates);
  const expectedContestCoordinates: Rect = {
    height: 374,
    width: 1161,
    x: 436,
    y: 1183,
  };
  expect(contestCoordinatesA).toEqual(expectedContestCoordinates);
  expect(writeInCoordinatesA).toMatchInlineSnapshot(`
    {
      "height": 140,
      "width": 270,
      "x": 1327,
      "y": 1274,
    }
  `);

  // check the second write-in image view, which should have the same image
  // but different writeInCoordinates
  const writeInImageViewB1 = await api.getWriteInImageView({
    writeInId: writeInIdB,
  });

  // contest and ballot coordinates should be the same, but write-in coordinates are different
  const {
    ballotCoordinates: ballotCoordinatesB,
    contestCoordinates: contestCoordinatesB,
    writeInCoordinates: writeInCoordinatesB,
  } = writeInImageViewB1 as HmpbWriteInImageView;
  expect(ballotCoordinatesB).toEqual(expectedBallotCoordinates);
  expect(contestCoordinatesB).toEqual(expectedContestCoordinates);
  expect(writeInCoordinatesB).toMatchInlineSnapshot(`
    {
      "height": 138,
      "width": 269,
      "x": 1328,
      "y": 1366,
    }
  `);
});

test('getWriteInImageView on bmd', async () => {
  const { auth, api } = buildTestEnvironment();
  const { electionDefinition, castVoteRecordExport } =
    electionTwoPartyPrimaryFixtures;
  await configureMachine(api, auth, electionDefinition);

  const reportDirectoryPath = castVoteRecordExport.asDirectoryPath();
  (
    await api.addCastVoteRecordFile({
      path: reportDirectoryPath,
    })
  ).unsafeUnwrap();

  // look at a contest that can have multiple write-ins per ballot
  const contestId = 'zoo-council-mammal';
  const writeInIds = api.getWriteInAdjudicationQueue({
    contestId,
  });
  expect(writeInIds).toHaveLength(24);
  const [writeInIdA, writeInIdB] = writeInIds;
  assert(writeInIdA !== undefined && writeInIdB !== undefined);

  // check image of first write-in
  const writeInImageViewA = await api.getWriteInImageView({
    writeInId: writeInIdA,
  });
  assert(writeInImageViewA);

  const { machineMarkedText: machineMarkedTextA } =
    writeInImageViewA as BmdWriteInImageView;

  expect(machineMarkedTextA).toEqual('Mock Write-In');

  // check the second write-in image view, which should have the same image
  // but different writeInCoordinates
  const writeInImageViewB1 = await api.getWriteInImageView({
    writeInId: writeInIdB,
  });

  const { machineMarkedText: machineMarkedTextB } =
    writeInImageViewB1 as BmdWriteInImageView;
  expect(machineMarkedTextB).toEqual('Mock Write-In');
});

test('getFirstPendingWriteInId', async () => {
  const { auth, api } = buildTestEnvironment();
  const { electionDefinition, castVoteRecordExport } =
    electionGridLayoutNewHampshireTestBallotFixtures;
  await configureMachine(api, auth, electionDefinition);

  (
    await api.addCastVoteRecordFile({
      path: castVoteRecordExport.asDirectoryPath(),
    })
  ).unsafeUnwrap();

  const contestId = 'State-Representatives-Hillsborough-District-34-b1012d38';

  const writeInQueue = api.getWriteInAdjudicationQueue({
    contestId,
  });

  function adjudicateAtIndex(index: number) {
    return api.adjudicateWriteIn({
      writeInId: writeInQueue[index]!,
      type: 'invalid',
    });
  }

  expect(api.getFirstPendingWriteInId({ contestId })).toEqual(writeInQueue[0]);

  adjudicateAtIndex(0);
  expect(api.getFirstPendingWriteInId({ contestId })).toEqual(writeInQueue[1]);

  adjudicateAtIndex(2);
  expect(api.getFirstPendingWriteInId({ contestId })).toEqual(writeInQueue[1]);

  adjudicateAtIndex(1);
  expect(api.getFirstPendingWriteInId({ contestId })).toEqual(writeInQueue[3]);

  for (const [i] of writeInQueue.entries()) {
    adjudicateAtIndex(i);
  }
  expect(api.getFirstPendingWriteInId({ contestId })).toEqual(null);
});

test('handling unmarked write-ins', async () => {
  const { api, auth } = buildTestEnvironment();
  const { electionDefinition, castVoteRecordExport } =
    electionGridLayoutNewHampshireTestBallotFixtures;
  const { election } = electionDefinition;
  await configureMachine(api, auth, electionDefinition);
  mockElectionManagerAuth(auth, electionDefinition.election);

  // modify the write-ins for a contest to be unmarked write-ins
  const WRITE_IN_CONTEST_ID = 'Governor-061a401b';
  const OFFICIAL_CANDIDATE_ID = 'Hannah-Dustin-ab4ef7c8';
  const exportDirectoryPath = await modifyCastVoteRecordExport(
    castVoteRecordExport.asDirectoryPath(),
    {
      castVoteRecordModifier: (cvr) => {
        const snapshot = find(
          cvr.CVRSnapshot,
          (s) => s.Type === CVR.CVRType.Modified
        );

        const writeInContest = snapshot.CVRContest.find(
          (c) => c.ContestId === WRITE_IN_CONTEST_ID
        );
        if (writeInContest) {
          const selectionPosition = writeInContest.CVRContestSelection.find(
            (sel) => sel.SelectionPosition[0]?.CVRWriteIn
          )?.SelectionPosition[0];
          if (selectionPosition) {
            writeInContest.WriteIns = 0;
            writeInContest.Undervotes = 1;
            selectionPosition.HasIndication = CVR.IndicationStatus.No;
            selectionPosition.IsAllocable = CVR.AllocationStatus.Unknown;
            selectionPosition.Status = [CVR.PositionStatus.Other];
            selectionPosition.OtherStatus =
              UNMARKED_WRITE_IN_SELECTION_POSITION_OTHER_STATUS;
          }
        }

        return cvr;
      },
    }
  );

  const addTestFileResult = await api.addCastVoteRecordFile({
    path: exportDirectoryPath,
  });
  assert(addTestFileResult.isOk());

  const [writeInId] = api.getWriteInAdjudicationQueue({
    contestId: WRITE_IN_CONTEST_ID,
  });
  assert(writeInId !== undefined);

  // check that the unmarked status appears in the write-in adjudication context
  const writeInContext = api.getWriteInAdjudicationContext({
    writeInId,
  });
  expect(writeInContext.writeIn.isUnmarked).toEqual(true);

  async function expectContestResults(
    contestSummary: ContestResultsSummary
  ): Promise<void> {
    const expectedResults = buildElectionResultsFixture({
      election,
      contestResultsSummaries: { [WRITE_IN_CONTEST_ID]: contestSummary },
      cardCounts: {
        bmd: 0,
        hmpb: [contestSummary.ballots],
      },
      includeGenericWriteIn: false,
    });
    expect(
      (await api.getResultsForTallyReports())[0]?.scannedResults.contestResults[
        WRITE_IN_CONTEST_ID
      ]
    ).toEqual(expectedResults.contestResults[WRITE_IN_CONTEST_ID]);
  }

  function expectWriteInSummary(
    summary: Partial<Tabulation.ContestWriteInSummary>
  ) {
    expect(
      api.getElectionWriteInSummary().contestWriteInSummaries[
        WRITE_IN_CONTEST_ID
      ]
    ).toMatchObject(summary);
  }

  // UWIs should appear in the write-in summary, but not in the tally results
  expectWriteInSummary({
    pendingTally: 2,
    invalidTally: 0,
    totalTally: 2,
  });
  await expectContestResults({
    type: 'candidate',
    ballots: 184,
    overvotes: 4,
    undervotes: 4,
    officialOptionTallies: {
      'Hannah-Dustin-ab4ef7c8': 2,
      'John-Spencer-9ffb5970': 172,
      'Josiah-Bartlett-1bb99985': 2,
    },
  });

  // a UWI should be reflected in tallies if we mark it as valid
  api.adjudicateWriteIn({
    writeInId,
    type: 'official-candidate',
    candidateId: OFFICIAL_CANDIDATE_ID,
  });
  expectWriteInSummary({
    pendingTally: 1,
    invalidTally: 0,
    totalTally: 2,
    candidateTallies: {
      [OFFICIAL_CANDIDATE_ID]: {
        id: OFFICIAL_CANDIDATE_ID,
        name: 'Hannah Dustin',
        tally: 1,
      },
    },
  });
  await expectContestResults({
    type: 'candidate',
    ballots: 184,
    overvotes: 4,
    undervotes: 3,
    officialOptionTallies: {
      'Hannah-Dustin-ab4ef7c8': 3,
      'John-Spencer-9ffb5970': 172,
      'Josiah-Bartlett-1bb99985': 2,
    },
  });

  // an invalid UWI should appear the same as unadjudicated in tallies
  api.adjudicateWriteIn({
    writeInId,
    type: 'invalid',
  });
  expectWriteInSummary({
    pendingTally: 1,
    invalidTally: 1,
    totalTally: 2,
  });
  await expectContestResults({
    type: 'candidate',
    ballots: 184,
    overvotes: 4,
    undervotes: 4,
    officialOptionTallies: {
      'Hannah-Dustin-ab4ef7c8': 2,
      'John-Spencer-9ffb5970': 172,
      'Josiah-Bartlett-1bb99985': 2,
    },
  });
});

test('adjudicating write-ins changes their status and is reflected in tallies', async () => {
  const { auth, api } = buildTestEnvironment();
  const { electionDefinition, castVoteRecordExport } =
    electionGridLayoutNewHampshireTestBallotFixtures;
  const { election } = electionDefinition;
  await configureMachine(api, auth, electionDefinition);
  (
    await api.addCastVoteRecordFile({
      path: castVoteRecordExport.asDirectoryPath(),
    })
  ).unsafeUnwrap();

  // look at a contest that can have multiple write-ins per ballot
  const contestId = 'Governor-061a401b';
  const writeInIds = api.getWriteInAdjudicationQueue({
    contestId,
  });
  expect(writeInIds).toHaveLength(2);
  const writeInId = writeInIds[0]!;

  async function expectContestResults(
    contestSummary: ContestResultsSummary
  ): Promise<void> {
    const expectedResults = buildElectionResultsFixture({
      election,
      contestResultsSummaries: { [contestId]: contestSummary },
      cardCounts: {
        bmd: 0,
        hmpb: [contestSummary.ballots],
      },
      includeGenericWriteIn: false,
    });
    expect(
      (await api.getResultsForTallyReports())[0]?.scannedResults.contestResults[
        contestId
      ]
    ).toEqual(expectedResults.contestResults[contestId]);
  }

  function expectWriteInSummary(summary: Tabulation.ContestWriteInSummary) {
    expect(
      api.getElectionWriteInSummary().contestWriteInSummaries[contestId]
    ).toEqual(summary);
  }

  function expectWriteInRecord(id: Id, expected: Partial<WriteInRecord>) {
    expect(
      api.getWriteInAdjudicationContext({ writeInId: id }).writeIn
    ).toMatchObject(expected);
  }

  // unadjudicated results
  expectWriteInRecord(writeInId, { status: 'pending' });
  expect(api.getWriteInAdjudicationQueueMetadata({ contestId })).toEqual([
    {
      contestId,
      pendingTally: 2,
      totalTally: 2,
    },
  ]);
  await expectContestResults({
    type: 'candidate',
    ballots: 184,
    overvotes: 4,
    undervotes: 2,
    officialOptionTallies: {
      'Hannah-Dustin-ab4ef7c8': 2,
      'John-Spencer-9ffb5970': 172,
      'Josiah-Bartlett-1bb99985': 2,
    },
    writeInOptionTallies: {
      [Tabulation.PENDING_WRITE_IN_ID]: {
        name: Tabulation.PENDING_WRITE_IN_NAME,
        tally: 2,
      },
    },
  });
  expectWriteInSummary({
    candidateTallies: {},
    contestId: 'Governor-061a401b',
    invalidTally: 0,
    pendingTally: 2,
    totalTally: 2,
  });

  // check invalid
  api.adjudicateWriteIn({
    type: 'invalid',
    writeInId,
  });
  expectWriteInRecord(writeInId, {
    adjudicationType: 'invalid',
    status: 'adjudicated',
  });
  await expectContestResults({
    type: 'candidate',
    ballots: 184,
    overvotes: 4,
    undervotes: 3,
    officialOptionTallies: {
      'Hannah-Dustin-ab4ef7c8': 2,
      'John-Spencer-9ffb5970': 172,
      'Josiah-Bartlett-1bb99985': 2,
    },
    writeInOptionTallies: {
      [Tabulation.PENDING_WRITE_IN_ID]: {
        name: Tabulation.PENDING_WRITE_IN_NAME,
        tally: 1,
      },
    },
  });
  expect(
    api.getElectionWriteInSummary().contestWriteInSummaries[contestId]
  ).toEqual({
    candidateTallies: {},
    contestId: 'Governor-061a401b',
    invalidTally: 1,
    pendingTally: 1,
    totalTally: 2,
  });

  // check official candidate
  api.adjudicateWriteIn({
    type: 'official-candidate',
    candidateId: 'Hannah-Dustin-ab4ef7c8',
    writeInId,
  });
  expectWriteInRecord(writeInId, {
    adjudicationType: 'official-candidate',
    candidateId: 'Hannah-Dustin-ab4ef7c8',
    status: 'adjudicated',
  });
  await expectContestResults({
    type: 'candidate',
    ballots: 184,
    overvotes: 4,
    undervotes: 2,
    officialOptionTallies: {
      'Hannah-Dustin-ab4ef7c8': 3,
      'John-Spencer-9ffb5970': 172,
      'Josiah-Bartlett-1bb99985': 2,
    },
    writeInOptionTallies: {
      [Tabulation.PENDING_WRITE_IN_ID]: {
        name: Tabulation.PENDING_WRITE_IN_NAME,
        tally: 1,
      },
    },
  });
  expectWriteInSummary({
    contestId: 'Governor-061a401b',
    invalidTally: 0,
    pendingTally: 1,
    totalTally: 2,
    candidateTallies: {
      'Hannah-Dustin-ab4ef7c8': {
        id: 'Hannah-Dustin-ab4ef7c8',
        isWriteIn: false,
        name: 'Hannah Dustin',
        tally: 1,
      },
    },
  });

  // check unofficial candidate
  const writeInCandidate = api.addWriteInCandidate({
    contestId,
    name: 'Mr. Hero',
  });
  api.adjudicateWriteIn({
    type: 'write-in-candidate',
    candidateId: writeInCandidate.id,
    writeInId,
  });
  expectWriteInRecord(writeInId, {
    adjudicationType: 'write-in-candidate',
    candidateId: writeInCandidate.id,
    status: 'adjudicated',
  });
  await expectContestResults({
    type: 'candidate',
    ballots: 184,
    overvotes: 4,
    undervotes: 2,
    officialOptionTallies: {
      'Hannah-Dustin-ab4ef7c8': 2,
      'John-Spencer-9ffb5970': 172,
      'Josiah-Bartlett-1bb99985': 2,
    },
    writeInOptionTallies: {
      [Tabulation.PENDING_WRITE_IN_ID]: {
        name: Tabulation.PENDING_WRITE_IN_NAME,
        tally: 1,
      },
      [writeInCandidate.id]: {
        name: writeInCandidate.name,
        tally: 1,
      },
    },
  });
  expectWriteInSummary({
    contestId: 'Governor-061a401b',
    invalidTally: 0,
    pendingTally: 1,
    totalTally: 2,
    candidateTallies: {
      [writeInCandidate.id]: {
        id: writeInCandidate.id,
        isWriteIn: true,
        name: writeInCandidate.name,
        tally: 1,
      },
    },
  });

  // circle back to invalid
  api.adjudicateWriteIn({
    type: 'invalid',
    writeInId,
  });
  expectWriteInRecord(writeInId, {
    adjudicationType: 'invalid',
    status: 'adjudicated',
  });
  await expectContestResults({
    type: 'candidate',
    ballots: 184,
    overvotes: 4,
    undervotes: 3,
    officialOptionTallies: {
      'Hannah-Dustin-ab4ef7c8': 2,
      'John-Spencer-9ffb5970': 172,
      'Josiah-Bartlett-1bb99985': 2,
    },
    writeInOptionTallies: {
      [Tabulation.PENDING_WRITE_IN_ID]: {
        name: Tabulation.PENDING_WRITE_IN_NAME,
        tally: 1,
      },
    },
  });
  expect(
    api.getElectionWriteInSummary().contestWriteInSummaries[contestId]
  ).toEqual({
    candidateTallies: {},
    contestId: 'Governor-061a401b',
    invalidTally: 1,
    pendingTally: 1,
    totalTally: 2,
  });

  // write-in candidate should be deleted as they are no longer referenced
  expect(api.getWriteInCandidates({ contestId })).toEqual([]);

  // adjudication queue metadata should be updated
  expect(api.getWriteInAdjudicationQueueMetadata({ contestId })).toEqual([
    {
      contestId,
      pendingTally: 1,
      totalTally: 2,
    },
  ]);
});
