import { type PollsState, type PrecinctSelection } from '@vx/libs/types/src';
import { type PrintBallotProps as BackendPrintBallotProps } from '../printing/print_ballot';

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

export type PrintBallotProps = Omit<
  BackendPrintBallotProps,
  'store' | 'printer'
>;
