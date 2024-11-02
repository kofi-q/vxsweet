import {
  mockCardlessVoterUser,
  mockPollWorkerUser,
  mockSessionExpiresAt,
} from '@vx/libs/test-utils/src';
import {
  constructElectionKey,
  InsertedSmartCardAuth,
} from '@vx/libs/types/src/auth';
import { type ElectionDefinition } from '@vx/libs/types/src';

export function mockPollWorkerAuth(
  electionDefinition: ElectionDefinition
): InsertedSmartCardAuth.PollWorkerLoggedIn {
  return {
    status: 'logged_in',
    user: mockPollWorkerUser({
      electionKey: constructElectionKey(electionDefinition.election),
    }),
    sessionExpiresAt: mockSessionExpiresAt(),
  };
}

export function mockCardlessVoterAuth(
  electionDefinition: ElectionDefinition
): InsertedSmartCardAuth.PollWorkerLoggedIn {
  const ballotStyleId = electionDefinition.election.ballotStyles[0].id;
  const precinctId = electionDefinition.election.precincts[0].id;

  return {
    ...mockPollWorkerAuth(electionDefinition),
    cardlessVoterUser: mockCardlessVoterUser({
      ballotStyleId,
      precinctId,
    }),
  };
}

export function mockCardlessVoterLoggedInAuth(
  electionDefinition: ElectionDefinition
): InsertedSmartCardAuth.CardlessVoterLoggedIn {
  const ballotStyleId = electionDefinition.election.ballotStyles[0].id;
  const precinctId = electionDefinition.election.precincts[0].id;

  return {
    ...mockPollWorkerAuth(electionDefinition),
    user: mockCardlessVoterUser({
      ballotStyleId,
      precinctId,
    }),
  };
}
