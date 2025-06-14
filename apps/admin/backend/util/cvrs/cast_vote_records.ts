import {
  type AnyContest,
  type ElectionDefinition,
} from '@vx/libs/types/elections';
import { Tabulation } from '@vx/libs/types/tabulation';
import { getContestById } from '@vx/libs/utils/src/tabulation';
import { type CastVoteRecordAdjudicationFlags } from '../../types/types';

function getNumberVotesAllowed(contest: AnyContest): number {
  if (contest.type === 'yesno') {
    return 1;
  }

  return contest.seats;
}

/**
 * Determines the summary adjudication flags for a cast vote record.
 */
export function getCastVoteRecordAdjudicationFlags(
  votes: Tabulation.Votes,
  electionDefinition: ElectionDefinition
): CastVoteRecordAdjudicationFlags {
  let isBlank = true;
  let hasUndervote = false;
  let hasOvervote = false;
  let hasWriteIn = false;

  for (const [contestId, optionIds] of Object.entries(votes)) {
    const contest = getContestById(electionDefinition, contestId);

    if (optionIds.length > 0) {
      isBlank = false;
    }

    const votesAllowed = getNumberVotesAllowed(contest);

    if (optionIds.length < votesAllowed) {
      hasUndervote = true;
    }

    if (optionIds.length > votesAllowed) {
      hasOvervote = true;
    }

    if (
      optionIds.some((optionId) =>
        optionId.startsWith(Tabulation.GENERIC_WRITE_IN_ID)
      )
    ) {
      hasWriteIn = true;
    }
  }

  return {
    isBlank,
    hasUndervote,
    hasOvervote,
    hasWriteIn,
  };
}
