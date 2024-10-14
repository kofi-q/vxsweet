import { Election, ElectionDefinition } from '@vx/libs/types/src';
import { sha256 } from 'js-sha256';

export function asElectionDefinition(election: Election): ElectionDefinition {
  const electionData = JSON.stringify(election);
  return {
    election,
    electionData,
    ballotHash: sha256(electionData),
  };
}
