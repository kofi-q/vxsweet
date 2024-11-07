import { mapObject } from '@vx/libs/basics/objects';
import { type BallotStyleGroupId, type Election } from '../elections/election';
import { ElectionStringKey } from '../ui_strings/ui_string_translations';

export function normalizeVxfAfterCdfConversion(
  vxfElection: Election
): Election {
  return {
    ...vxfElection,
    // CDF only has one field for party name, so we lose `party.name`
    parties: vxfElection.parties.map((party) => ({
      ...party,
      name: party.fullName,
    })),
    // CDF only has one field for ballot style id so the group id is always the ballot style id
    ballotStyles: vxfElection.ballotStyles.map((bs) => ({
      ...bs,
      groupId: bs.id as unknown as BallotStyleGroupId,
    })),
    ballotStrings: mapObject(vxfElection.ballotStrings, (strings) => ({
      ...strings,
      [ElectionStringKey.PARTY_NAME]:
        strings[ElectionStringKey.PARTY_FULL_NAME],
    })),
    // No field in CDF for seal
    seal: '',
  };
}
