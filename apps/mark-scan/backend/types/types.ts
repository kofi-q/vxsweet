import {
  type BallotStyleId,
  type VotesDict,
  type PrecinctSelection,
  type PollsState,
} from '@vx/libs/types/elections';

export interface MachineConfig {
  machineId: string;
  codeVersion: string;
  screenOrientation: ScreenOrientation;
}

export interface ElectionState {
  precinctSelection?: PrecinctSelection;
  ballotsPrintedCount: number;
  isTestMode: boolean;
  pollsState: PollsState;
}

export type ScreenOrientation = 'portrait' | 'landscape';

export interface PrintBallotProps {
  languageCode: string;
  precinctId: string;
  ballotStyleId: BallotStyleId;
  votes: VotesDict;
}

export type BmdModelNumber = 'bmd-150' | 'bmd-155';
