import {
  type BallotStyleId,
  type ElectionDefinition,
  type PrecinctId,
  type VotesDict,
} from '@vx/libs/types/elections';
import { type MachineConfig } from '../../backend/types/types';
import {
  type ContestsWithMsEitherNeither,
  type UpdateVoteFunction,
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
