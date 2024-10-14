import type { ElectionRecord } from '@vx/apps/design/backend/src';
import {
  createBlankElection,
  convertVxfPrecincts,
  generateBallotStyles,
  BallotLanguageConfigs,
} from '@vx/apps/design/backend/src';
import {
  electionPrimaryPrecinctSplitsFixtures,
  electionGeneral,
} from '@vx/libs/fixtures/src';
import {
  DEFAULT_SYSTEM_SETTINGS,
  Election,
  ElectionId,
  LanguageCode,
} from '@vx/libs/types/src';
import { generateId } from '../src/utils';

export function makeElectionRecord(baseElection: Election): ElectionRecord {
  const ballotLanguageConfigs: BallotLanguageConfigs = [
    { languages: [LanguageCode.ENGLISH] },
  ];
  const precincts = convertVxfPrecincts(baseElection);
  const ballotStyles = generateBallotStyles({
    ballotLanguageConfigs,
    contests: baseElection.contests,
    electionType: baseElection.type,
    parties: baseElection.parties,
    precincts,
  });
  const election: Election = {
    ...baseElection,
    ballotStyles: ballotStyles.map((ballotStyle) => ({
      id: ballotStyle.id,
      groupId: ballotStyle.group_id,
      precincts: ballotStyle.precinctsOrSplits.map((p) => p.precinctId),
      districts: ballotStyle.districtIds,
      partyId: ballotStyle.partyId,
    })),
  };
  return {
    election,
    systemSettings: DEFAULT_SYSTEM_SETTINGS,
    precincts,
    ballotStyles,
    createdAt: new Date().toISOString(),
    ballotLanguageConfigs,
  };
}

export const blankElectionRecord = makeElectionRecord(
  createBlankElection(generateId() as ElectionId)
);
export const generalElectionRecord = makeElectionRecord(electionGeneral);
export const primaryElectionRecord = makeElectionRecord(
  electionPrimaryPrecinctSplitsFixtures.election
);
