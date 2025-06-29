import * as electionFamousNames2021Fixtures from '@vx/libs/fixtures/src/data/electionFamousNames2021';
import * as electionGridLayoutNewHampshireTestBallotFixtures from '@vx/libs/fixtures/src/data/electionGridLayoutNewHampshireTestBallot';
import {
  type BallotStyleId,
  BallotType,
  getBallotStyle,
  getContests,
} from '@vx/libs/types/elections';
import { assert, throwIllegalValue } from '@vx/libs/basics/assert';
import { find } from '@vx/libs/basics/collections';
import { getCastVoteRecordBallotType } from '@vx/libs/utils/src';
import { generateCvrs } from './generate_cvrs';
import { IMAGE_URI_REGEX } from './utils';

test('produces well-formed cast vote records with all contests in HMPB (gridlayouts) case', async () => {
  const election =
    electionGridLayoutNewHampshireTestBallotFixtures.electionJson.election;
  const electionDefinition =
    electionGridLayoutNewHampshireTestBallotFixtures.electionJson.toElectionDefinition();
  for await (const cvr of generateCvrs({
    electionDefinition,
    scannerIds: ['scanner-1'],
    testMode: true,
  })) {
    expect(cvr.CVRSnapshot).toHaveLength(1);
    expect(cvr.BallotSheetId).toEqual('1');
    const ballotStyleId = cvr.BallotStyleId as BallotStyleId;
    expect(
      cvr.CVRSnapshot[0]!.CVRContest?.map((cvrContest) => cvrContest.ContestId)
    ).toMatchObject(
      expect.arrayContaining(
        getContests({
          ballotStyle: getBallotStyle({
            ballotStyleId,
            election,
          })!,
          election,
        }).map((contest) => contest.id)
      )
    );
  }
});

test('produces well-formed cast vote records with all contests in BMD (non-gridlayouts) case', async () => {
  const election = electionFamousNames2021Fixtures.electionJson.election;
  const electionDefinition =
    electionFamousNames2021Fixtures.electionJson.toElectionDefinition();
  for await (const cvr of generateCvrs({
    electionDefinition,
    scannerIds: ['scanner-1'],
    testMode: true,
  })) {
    expect(cvr.CVRSnapshot).toHaveLength(1);
    expect(cvr.BallotSheetId).toBeUndefined();
    const ballotStyleId = cvr.BallotStyleId as BallotStyleId;
    expect(
      cvr.CVRSnapshot[0]!.CVRContest?.map((cvrContest) => cvrContest.ContestId)
    ).toMatchObject(
      expect.arrayContaining(
        getContests({
          ballotStyle: getBallotStyle({
            ballotStyleId,
            election,
          })!,
          election,
        }).map((contest) => contest.id)
      )
    );
  }
});

test('has absentee and precinct ballot types', async () => {
  let seenAbsentee = false;
  let seenPrecinct = false;

  for await (const cvr of generateCvrs({
    testMode: false,
    scannerIds: ['scanner-1'],
    electionDefinition:
      electionFamousNames2021Fixtures.electionJson.toElectionDefinition(),
  })) {
    const ballotType = getCastVoteRecordBallotType(cvr);
    assert(ballotType);
    switch (ballotType) {
      case BallotType.Absentee:
        seenAbsentee = true;
        break;

      case BallotType.Precinct:
        seenPrecinct = true;
        break;

      case undefined:
      case BallotType.Provisional:
        break;

      default:
        throwIllegalValue(ballotType);
    }

    if (seenAbsentee && seenPrecinct) {
      break;
    }
  }

  expect(seenAbsentee).toEqual(true);
  expect(seenPrecinct).toEqual(true);
});

test('uses all the scanners given', async () => {
  const scanners = new Set<string>();

  for await (const cvr of generateCvrs({
    testMode: false,
    scannerIds: ['scanner-1', 'scanner-2'],
    electionDefinition:
      electionFamousNames2021Fixtures.electionJson.toElectionDefinition(),
  })) {
    expect(cvr.CreatingDeviceId).toBeDefined();
    assert(typeof cvr.CreatingDeviceId !== 'undefined');
    scanners.add(cvr.CreatingDeviceId);
  }

  expect([...scanners].sort()).toStrictEqual(['scanner-1', 'scanner-2']);
});

test('adds write-ins for contests that allow them', async () => {
  const writeInContest = electionFamousNames2021Fixtures.election.contests.find(
    (contest) => contest.type === 'candidate' && contest.allowWriteIns
  )!;
  let seenWriteIn = false;

  for await (const cvr of generateCvrs({
    testMode: false,
    scannerIds: ['scanner-1'],
    electionDefinition:
      electionFamousNames2021Fixtures.electionJson.toElectionDefinition(),
  })) {
    const cvrContests = cvr.CVRSnapshot[0]?.CVRContest;
    assert(cvrContests);
    const cvrContest = find(
      cvrContests,
      (contest) => contest.ContestId === writeInContest.id
    );

    if (
      cvrContest.CVRContestSelection?.some(
        (selection) => selection.ContestSelectionId?.startsWith('write-in-')
      )
    ) {
      seenWriteIn = true;
      break;
    }
  }

  expect(seenWriteIn).toEqual(true);
});

test('adds write-ins for contests that have 1 seat', async () => {
  const writeInContest = electionFamousNames2021Fixtures.election.contests.find(
    (contest) =>
      contest.type === 'candidate' &&
      contest.allowWriteIns &&
      contest.seats === 1
  )!;
  let seenWriteIn = false;

  for await (const cvr of generateCvrs({
    scannerIds: ['scanner-1'],
    testMode: false,
    electionDefinition:
      electionFamousNames2021Fixtures.electionJson.toElectionDefinition(),
  })) {
    const cvrContests = cvr.CVRSnapshot[0]?.CVRContest;
    assert(cvrContests);
    const cvrContest = find(
      cvrContests,
      (contest) => contest.ContestId === writeInContest.id
    );

    if (
      cvrContest.CVRContestSelection?.some(
        (selection) => selection.ContestSelectionId?.startsWith('write-in-')
      )
    ) {
      seenWriteIn = true;
      break;
    }
  }

  expect(seenWriteIn).toEqual(true);
});

test('can include ballot image references for write-ins (gridLayouts)', async () => {
  let reportHasWriteIn = false;
  for await (const cvr of generateCvrs({
    testMode: false,
    scannerIds: ['scanner-1'],
    electionDefinition:
      electionGridLayoutNewHampshireTestBallotFixtures.electionJson.toElectionDefinition(),
  })) {
    let cvrHasWriteIn = false;
    const selectionPositions = cvr.CVRSnapshot[0]!.CVRContest.flatMap(
      (cvrContest) => cvrContest.CVRContestSelection
    ).flatMap((cvrContestSelection) => cvrContestSelection.SelectionPosition);

    for (const selectionPosition of selectionPositions) {
      if (selectionPosition.CVRWriteIn) {
        reportHasWriteIn = true;
        cvrHasWriteIn = true;

        expect(selectionPosition.CVRWriteIn).toMatchObject({
          '@type': 'CVR.CVRWriteIn',
          WriteInImage: {
            Location: expect.stringMatching(IMAGE_URI_REGEX),
          },
        });
      }
    }

    if (cvrHasWriteIn) {
      const firstImageDataLocation = cvr.BallotImage?.[0]?.Location;
      const secondImageDataLocation = cvr.BallotImage?.[1]?.Location;
      expect(firstImageDataLocation ?? secondImageDataLocation).toBeDefined();
    } else {
      expect(cvr.BallotImage).toBeUndefined();
    }
  }

  expect(reportHasWriteIn).toBeTruthy();
});
