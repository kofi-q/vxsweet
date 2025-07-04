import {
  BallotType,
  getGroupIdFromBallotStyleId,
} from '@vx/libs/types/elections';
import {
  type InterpretedBmdPage,
  type InterpretedHmpbPage,
  type PageInterpretation,
} from '@vx/libs/types/scanning';
import { Tabulation } from '@vx/libs/types/tabulation';
import {
  convertVotesDictToTabulationVotes,
  getBallotStyleIdPartyIdLookup,
  groupMapToGroupList,
  tabulateCastVoteRecords,
} from '@vx/libs/utils/src/tabulation';
import { assert, assertDefined } from '@vx/libs/basics/assert';
import { typedAs } from '@vx/libs/basics/types';
import { iter } from '@vx/libs/basics/iterators';
import { VX_MACHINE_ID } from '@vx/libs/backend/scan_globals';
import { Store } from '../store/store';

function isBmdPage(
  interpretation: PageInterpretation
): interpretation is InterpretedBmdPage {
  return interpretation.type === 'InterpretedBmdPage';
}

function isHmpbPage(
  interpretation: PageInterpretation
): interpretation is InterpretedHmpbPage {
  return interpretation.type === 'InterpretedHmpbPage';
}

const BALLOT_TYPE_TO_VOTING_METHOD: Record<
  BallotType,
  Tabulation.VotingMethod
> = {
  [BallotType.Absentee]: 'absentee',
  [BallotType.Precinct]: 'precinct',
  [BallotType.Provisional]: 'provisional',
};

export async function getScannerResults({
  store,
}: {
  store: Store;
}): Promise<Tabulation.GroupList<Tabulation.ElectionResults>> {
  const { electionDefinition } = assertDefined(store.getElectionRecord());
  const { election } = electionDefinition;
  const ballotStyleIdPartyIdLookup = getBallotStyleIdPartyIdLookup(election);

  const cvrs = iter(store.forEachAcceptedSheet()).map((resultSheet) => {
    const [frontInterpretation, backInterpretation] =
      resultSheet.interpretation;

    if (isHmpbPage(frontInterpretation)) {
      assert(isHmpbPage(backInterpretation));

      const sheetNumber = Math.round(
        Math.max(
          frontInterpretation.metadata.pageNumber,
          backInterpretation.metadata.pageNumber
        ) / 2
      );
      const frontBallotStyleGroupId = getGroupIdFromBallotStyleId({
        ballotStyleId: frontInterpretation.metadata.ballotStyleId,
        election,
      });

      return typedAs<Tabulation.CastVoteRecord>({
        votes: convertVotesDictToTabulationVotes({
          ...frontInterpretation.votes,
          ...backInterpretation.votes,
        }),
        card: {
          type: 'hmpb',
          sheetNumber,
        },
        batchId: resultSheet.batchId,
        scannerId: VX_MACHINE_ID,
        precinctId: frontInterpretation.metadata.precinctId,
        ballotStyleGroupId: frontBallotStyleGroupId,
        partyId: ballotStyleIdPartyIdLookup[frontBallotStyleGroupId],
        votingMethod:
          BALLOT_TYPE_TO_VOTING_METHOD[frontInterpretation.metadata.ballotType],
      });
    }

    // we assume that we have a BMD ballot if it's not an HMPB ballot
    const interpretation = isBmdPage(frontInterpretation)
      ? frontInterpretation
      : backInterpretation;
    assert(isBmdPage(interpretation));
    const backBallotStyleGroupId = getGroupIdFromBallotStyleId({
      ballotStyleId: interpretation.metadata.ballotStyleId,
      election,
    });

    return typedAs<Tabulation.CastVoteRecord>({
      votes: convertVotesDictToTabulationVotes(interpretation.votes),
      card: {
        type: 'bmd',
      },
      batchId: resultSheet.batchId,
      scannerId: VX_MACHINE_ID,
      precinctId: interpretation.metadata.precinctId,
      ballotStyleGroupId: backBallotStyleGroupId,
      partyId: ballotStyleIdPartyIdLookup[backBallotStyleGroupId],
      votingMethod:
        BALLOT_TYPE_TO_VOTING_METHOD[interpretation.metadata.ballotType],
    });
  });

  return groupMapToGroupList(
    await tabulateCastVoteRecords({
      election,
      groupBy: election.type === 'primary' ? { groupByParty: true } : undefined,
      cvrs,
    })
  );
}
