import {
  type BallotStyleId,
  type ElectionDefinition,
} from '@vx/libs/types/elections';
import { useCurrentLanguage } from '@vx/libs/ui/ui_strings';
import { getRelatedBallotStyle } from '@vx/libs/utils/src';
import React from 'react';

export interface BallotStyleManagerParams {
  currentBallotStyleId?: BallotStyleId;
  electionDefinition?: ElectionDefinition | null;
  updateCardlessVoterBallotStyle: (input: {
    ballotStyleId: BallotStyleId;
  }) => unknown;
}

export function useBallotStyleManager(params: BallotStyleManagerParams): void {
  const {
    currentBallotStyleId,
    electionDefinition,
    updateCardlessVoterBallotStyle,
  } = params;

  const currentLanguage = useCurrentLanguage();
  React.useEffect(() => {
    if (!currentBallotStyleId || !electionDefinition) {
      return;
    }

    const ballotStyleForCurrentLanguage = getRelatedBallotStyle({
      ballotStyles: electionDefinition.election.ballotStyles,
      sourceBallotStyleId: currentBallotStyleId,
      targetBallotStyleLanguage: currentLanguage,
    }).unsafeUnwrap();

    if (ballotStyleForCurrentLanguage.id === currentBallotStyleId) {
      return;
    }

    updateCardlessVoterBallotStyle({
      ballotStyleId: ballotStyleForCurrentLanguage.id,
    });
  }, [
    currentBallotStyleId,
    currentLanguage,
    electionDefinition,
    updateCardlessVoterBallotStyle,
  ]);
}
