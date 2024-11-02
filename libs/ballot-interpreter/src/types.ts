import {
  AdjudicationReason,
  type ElectionDefinition,
  type MarkThresholds,
  type PrecinctSelection,
} from '@vx/libs/types/src';

/**
 * Options for interpreting a sheet of ballot images.
 */
export interface InterpreterOptions {
  adjudicationReasons: readonly AdjudicationReason[];
  electionDefinition: ElectionDefinition;
  allowOfficialBallotsInTestMode?: boolean;
  markThresholds: MarkThresholds;
  precinctSelection: PrecinctSelection;
  testMode: boolean;
}
