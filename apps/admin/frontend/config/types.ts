import {
  type BallotStyleGroupId,
  type ContestId,
  type PrecinctId,
} from '@vx/libs/types/elections';
import { type PromiseOr } from '@vx/libs/types/basic';
import { type ManualResultsVotingMethod } from '../../backend/types/types';

// Events
export type InputEventFunction = (
  event: React.FormEvent<HTMLInputElement>
) => PromiseOr<void>;
export type TextareaEventFunction = (
  event: React.FormEvent<HTMLTextAreaElement>
) => PromiseOr<void>;

// Router Params
export interface ManualTallyFormParams {
  precinctId: PrecinctId;
  ballotStyleGroupId: BallotStyleGroupId;
  votingMethod: ManualResultsVotingMethod;
}
export interface ManualTallyFormContestParams extends ManualTallyFormParams {
  contestId: ContestId;
}
export interface WriteInsAdjudicationScreenParams {
  contestId: ContestId;
}

export interface CastVoteRecordFilePreprocessedData {
  readonly name: string;
  readonly path: string;
  readonly cvrCount: number;
  readonly scannerIds: readonly string[];
  readonly exportTimestamp: Date;
  readonly isTestModeResults: boolean;
}

export type Iso8601Timestamp = string;
