import { type ElectionRecord } from '../../backend/store/store';
import {
  createBlankElection,
  convertVxfPrecincts,
} from '../../backend/app/app';
import { generateBallotStyles } from '../../backend/ballot-styles/ballot_styles';
import { type BallotLanguageConfigs } from '../../backend/types/types';
import {
  electionPrimaryPrecinctSplitsFixtures,
  electionGeneral,
} from '@vx/libs/fixtures/src';
import {
  DEFAULT_SYSTEM_SETTINGS,
  type Election,
  type ElectionId,
  LanguageCode,
} from '@vx/libs/types/src';
import { generateId } from '../util/utils';

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
