import React from 'react';

import { Button } from '@vx/libs/ui/buttons';
import { Icons, P } from '@vx/libs/ui/primitives';
import {
  type BallotStyleId,
  type PrecinctId,
  type VotesDict,
} from '@vx/libs/types/elections';
import { assert } from '@vx/libs/basics/assert';

import * as api from '../../api/api';
import { CenteredCardPageLayout } from '../../components/centered_card_page_layout';

export interface InsertedPreprintedBallotScreenProps {
  activateCardlessVoterSession: (
    precinctId: PrecinctId,
    ballotStyleId: BallotStyleId
  ) => void;
  setVotes: (votes: VotesDict) => void;
}

export function InsertedPreprintedBallotScreen(
  props: InsertedPreprintedBallotScreenProps
): React.ReactNode {
  const { activateCardlessVoterSession, setVotes } = props;

  const startSessionWithPreprintedBallot =
    api.startSessionWithPreprintedBallot.useMutation().mutate;

  const returnPreprintedBallot =
    api.returnPreprintedBallot.useMutation().mutate;

  const interpretationQuery = api.getInterpretation.useQuery();
  const interpretation = interpretationQuery.data;

  const onPressReview = React.useCallback(() => {
    assert(interpretation);
    assert(interpretation.type === 'InterpretedBmdPage');

    const { ballotStyleId, precinctId } = interpretation.metadata;

    activateCardlessVoterSession(precinctId, ballotStyleId);
    startSessionWithPreprintedBallot();
    setVotes(interpretation.votes);
  }, [
    activateCardlessVoterSession,
    startSessionWithPreprintedBallot,
    interpretation,
    setVotes,
  ]);

  if (!interpretationQuery.isSuccess) {
    return null;
  }

  return (
    <CenteredCardPageLayout
      buttons={
        <React.Fragment>
          <Button onPress={returnPreprintedBallot}>
            No, Return the Ballot
          </Button>
          <Button onPress={onPressReview} variant="primary">
            Yes, Review Ballot
          </Button>
        </React.Fragment>
      }
      icon={<Icons.Info />}
      title="Ballot Detected"
      voterFacing={false}
    >
      <P>The inserted sheet already has a ballot printed on it.</P>
      <P>Would you like to let the voter review and cast this ballot?</P>
    </CenteredCardPageLayout>
  );
}
