import { iter } from '@vx/libs/basics/iterators';
import {
  type CandidateContest,
  type Election,
  type Vote,
  type VotesDict,
  type YesNoContest,
} from '@vx/libs/types/elections';

function generateMockCandidateVote(contest: CandidateContest, seed = 0): Vote {
  return iter(contest.candidates)
    .cycle()
    .skip(seed)
    .take(Math.min(contest.seats, contest.candidates.length))
    .toArray();
}

function generateMockYesNoVote(c: YesNoContest, seed = 0): Vote {
  if (seed % 2 === 0) {
    return [c.yesOption.id];
  }

  return [c.noOption.id];
}

export function generateMockVotes(election: Election): VotesDict {
  return Object.fromEntries(
    election.contests.map((c, index) => [
      c.id,
      c.type === 'yesno'
        ? generateMockYesNoVote(c, index)
        : generateMockCandidateVote(c, index),
    ])
  );
}
