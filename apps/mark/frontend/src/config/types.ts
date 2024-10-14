import {
  BallotStyleId,
  ElectionDefinition,
  PrecinctId,
  VotesDict,
} from '@vx/libs/types/src';
import type { MachineConfig } from '@vx/apps/mark/backend/src';
import {
  ContestsWithMsEitherNeither,
  UpdateVoteFunction,
} from '@vx/libs/mark-flow-ui/src';

// Ballot
export interface BallotContextInterface {
  machineConfig: MachineConfig;
  ballotStyleId?: BallotStyleId;
  contests: ContestsWithMsEitherNeither;
  readonly electionDefinition?: ElectionDefinition;
  generateBallotId: () => string;
  isCardlessVoter: boolean;
  isLiveMode: boolean;
  endVoterSession: () => Promise<void>;
  precinctId?: PrecinctId;
  resetBallot: (showPostVotingInstructions?: boolean) => void;
  updateVote: UpdateVoteFunction;
  votes: VotesDict;
}
