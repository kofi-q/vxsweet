import { assert } from '@vx/libs/basics/assert';
import { type Optional } from '@vx/libs/basics/types';
import { readElection } from '@vx/libs/fs/src';
import { allBubbleBallotFixtures } from '@vx/libs/hmpb/src';
import {
  AdjudicationReason,
  asSheet,
  type Candidate,
  type CandidateVote,
  DEFAULT_MARK_THRESHOLDS,
  type ElectionDefinition,
} from '@vx/libs/types/elections';
import { singlePrecinctSelectionFor } from '@vx/libs/utils/src';
import { pdfToPageImages, sortVotesDict } from '../test/helpers/interpretation';
import { interpretSheet } from '../src/interpret';

describe('Interpret - HMPB - All bubble ballot', () => {
  const {
    electionPath,
    blankBallotPath,
    filledBallotPath,
    cyclingTestDeckPath,
  } = allBubbleBallotFixtures;
  let electionDefinition: ElectionDefinition;
  beforeAll(async () => {
    electionDefinition = (await readElection(electionPath)).unsafeUnwrap();
  });

  test('Blank ballot interpretation', async () => {
    const precinctId = electionDefinition.election.precincts[0]!.id;
    const images = asSheet(await pdfToPageImages(blankBallotPath).toArray());
    const [frontResult, backResult] = await interpretSheet(
      {
        electionDefinition,
        precinctSelection: singlePrecinctSelectionFor(precinctId),
        testMode: true,
        markThresholds: DEFAULT_MARK_THRESHOLDS,
        adjudicationReasons: [AdjudicationReason.Overvote],
      },
      images
    );

    assert(frontResult.interpretation.type === 'InterpretedHmpbPage');
    expect(frontResult.interpretation.votes).toEqual({
      'test-contest-page-1': [],
    });

    assert(backResult.interpretation.type === 'InterpretedHmpbPage');
    expect(backResult.interpretation.votes).toEqual({
      'test-contest-page-2': [],
    });
  });

  test('Filled ballot interpretation', async () => {
    const precinctId = electionDefinition.election.precincts[0]!.id;
    const [frontContest, backContest] = electionDefinition.election.contests;
    assert(frontContest?.type === 'candidate');
    assert(backContest?.type === 'candidate');
    const images = asSheet(await pdfToPageImages(filledBallotPath).toArray());
    const [frontResult, backResult] = await interpretSheet(
      {
        electionDefinition,
        precinctSelection: singlePrecinctSelectionFor(precinctId),
        testMode: true,
        markThresholds: DEFAULT_MARK_THRESHOLDS,
        adjudicationReasons: [AdjudicationReason.Overvote],
      },
      images
    );

    assert(frontResult.interpretation.type === 'InterpretedHmpbPage');
    expect(frontResult.interpretation.votes).toEqual({
      [frontContest.id]: frontContest.candidates,
    });

    assert(backResult.interpretation.type === 'InterpretedHmpbPage');
    expect(backResult.interpretation.votes).toEqual({
      [backContest.id]: backContest.candidates,
    });
  });

  test('Cycling test deck interpretation', async () => {
    const precinctId = electionDefinition.election.precincts[0]!.id;
    const [frontContest, backContest] = electionDefinition.election.contests;
    assert(frontContest?.type === 'candidate');
    assert(backContest?.type === 'candidate');
    const votes = {
      [frontContest.id]: [] as Candidate[],
      [backContest.id]: [] as Candidate[],
    } as const;

    const ballotImagePaths = pdfToPageImages(cyclingTestDeckPath);
    for await (const sheetImages of ballotImagePaths.chunks(2)) {
      const [frontResult, backResult] = await interpretSheet(
        {
          electionDefinition,
          precinctSelection: singlePrecinctSelectionFor(precinctId),
          testMode: true,
          markThresholds: DEFAULT_MARK_THRESHOLDS,
          adjudicationReasons: [AdjudicationReason.Overvote],
        },
        asSheet(sheetImages)
      );

      assert(frontResult.interpretation.type === 'InterpretedHmpbPage');
      assert(backResult.interpretation.type === 'InterpretedHmpbPage');

      for (const [contestId, candidates] of Object.entries({
        ...frontResult.interpretation.votes,
        ...backResult.interpretation.votes,
      })) {
        votes[contestId]!.push(
          ...((candidates as Optional<CandidateVote>) ?? [])
        );
      }
    }

    expect(sortVotesDict(votes)).toEqual(
      sortVotesDict({
        [frontContest.id]: frontContest.candidates,
        [backContest.id]: backContest.candidates,
      })
    );
  }, 60_000);
});
