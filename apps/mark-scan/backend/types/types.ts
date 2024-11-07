import {
  type BallotStyleId,
  type VotesDict,
  type PrecinctSelection,
  type PollsState,
} from '@vx/libs/types/elections';
import { LanguageCode } from '@vx/libs/types/languages';

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
