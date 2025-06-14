import * as electionPrimaryPrecinctSplits from '@vx/libs/fixtures/src/data/electionPrimaryPrecinctSplits/election.json';
import * as electionFamousNames2021 from '@vx/libs/fixtures/src/data/electionFamousNames2021/election.json';
import * as electionTwoPartyPrimary from '@vx/libs/fixtures/src/data/electionTwoPartyPrimary/election.json';
import { find } from '@vx/libs/basics/collections';
import {
  doesContestAppearOnPartyBallot,
  getContestIdsForBallotStyle,
  getContestIdsForPrecinct,
  getContestsForPrecinct,
} from './contest_filtering';

const electionTwoPartyPrimaryDefinition =
  electionTwoPartyPrimary.toElectionDefinition();
const electionPrimaryPrecinctSplitsDefinition =
  electionPrimaryPrecinctSplits.toElectionDefinition();
const electionFamousNames2021Definition =
  electionFamousNames2021.toElectionDefinition();

describe('doesContestAppearOnPartyBallot', () => {
  test('in a primary election', () => {
    const electionDefinition = electionTwoPartyPrimaryDefinition;

    const { contests } = electionDefinition.election;
    const mammalContest = find(contests, (c) => c.id === 'best-animal-mammal');
    const fishContest = find(contests, (c) => c.id === 'best-animal-fish');
    const ballotMeasure = find(contests, (c) => c.id === 'fishing');

    expect(doesContestAppearOnPartyBallot(mammalContest, '0')).toEqual(true);
    expect(doesContestAppearOnPartyBallot(mammalContest, '1')).toEqual(false);

    expect(doesContestAppearOnPartyBallot(fishContest, '0')).toEqual(false);
    expect(doesContestAppearOnPartyBallot(fishContest, '1')).toEqual(true);

    expect(doesContestAppearOnPartyBallot(ballotMeasure, '0')).toEqual(true);
    expect(doesContestAppearOnPartyBallot(ballotMeasure, '1')).toEqual(true);
  });

  test('in a general election', () => {
    const electionDefinition = electionFamousNames2021Definition;

    const { contests } = electionDefinition.election;
    const generalElectionCandidateContest = find(
      contests,
      (c) => c.type === 'candidate'
    );

    expect(
      doesContestAppearOnPartyBallot(generalElectionCandidateContest)
    ).toEqual(true);
  });
});

test('getContestIdsForBallotStyle', () => {
  const electionDefinition = electionTwoPartyPrimaryDefinition;
  expect([...getContestIdsForBallotStyle(electionDefinition, '1M')]).toEqual([
    'best-animal-mammal',
    'zoo-council-mammal',
    'new-zoo-either',
    'new-zoo-pick',
    'fishing',
  ]);
  expect([...getContestIdsForBallotStyle(electionDefinition, '2F')]).toEqual([
    'best-animal-fish',
    'aquarium-council-fish',
    'new-zoo-either',
    'new-zoo-pick',
    'fishing',
  ]);
});

test('getContestIdsForPrecinct', () => {
  const electionDefinition = electionPrimaryPrecinctSplitsDefinition;
  expect([
    ...getContestIdsForPrecinct(electionDefinition, 'precinct-c1-w1-1'),
  ]).toEqual([
    'county-leader-mammal',
    'congressional-1-mammal',
    'water-1-fishing',
    'county-leader-fish',
    'congressional-1-fish',
  ]);
  expect([
    ...getContestIdsForPrecinct(electionDefinition, 'precinct-c1-w2'),
  ]).toEqual([
    'county-leader-mammal',
    'congressional-1-mammal',
    'water-2-fishing',
    'county-leader-fish',
    'congressional-1-fish',
  ]);
});

test('getContestsForPrecinct', () => {
  const electionDefinition = electionPrimaryPrecinctSplitsDefinition;
  expect(
    getContestsForPrecinct(electionDefinition, 'precinct-c1-w2').map(
      (c) => c.id
    )
  ).toEqual([
    'county-leader-mammal',
    'congressional-1-mammal',
    'water-2-fishing',
    'county-leader-fish',
    'congressional-1-fish',
  ]);
});
