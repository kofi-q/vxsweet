import { assert } from '@vx/libs/basics/assert';
import { type Candidate, type VotesDict } from '@vx/libs/types/elections';
import { Tabulation } from '@vx/libs/types/tabulation';

export function convertVotesDictToTabulationVotes(
  votesDict: VotesDict
): Tabulation.Votes {
  const tabulationVotes: Tabulation.Votes = {};

  for (const [contestId, vote] of Object.entries(votesDict)) {
    assert(vote);

    if (vote.length === 0) {
      tabulationVotes[contestId] = [];
      continue;
    }

    const voteOption = vote[0];
    assert(voteOption !== undefined);

    if (typeof voteOption === 'string') {
      tabulationVotes[contestId] = vote as unknown as string[];
    } else {
      tabulationVotes[contestId] = vote.map((c) => (c as Candidate).id);
    }
  }

  return tabulationVotes;
}

export function filterVotesByContestIds({
  votes,
  contestIds,
}: {
  votes: Tabulation.Votes;
  contestIds: string[];
}): Tabulation.Votes {
  const filteredVotes: Tabulation.Votes = {};

  for (const contestId of contestIds) {
    const vote = votes[contestId];
    if (vote) {
      filteredVotes[contestId] = vote;
    }
  }

  return filteredVotes;
}
