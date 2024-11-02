import {
  type BallotStyleId,
  LanguageCode,
  type PollsState,
  type PrecinctSelection,
  type VotesDict,
} from '@vx/libs/types/src';

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
  languageCode: LanguageCode;
  precinctId: string;
  ballotStyleId: BallotStyleId;
  votes: VotesDict;
}

export type BmdModelNumber = 'bmd-150' | 'bmd-155';
