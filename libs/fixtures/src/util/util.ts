import {
  type Election,
  type ElectionDefinition,
} from '@vx/libs/types/elections';
import { sha256 } from 'js-sha256';

export function asElectionDefinition(election: Election): ElectionDefinition {
  const electionData = JSON.stringify(election);
  return {
    election,
    electionData,
    ballotHash: sha256(electionData),
  };
}
