/* istanbul ignore file - placeholder component that will change */
import React from 'react';

import styled from 'styled-components';
import { H1, P } from '@vx/libs/ui/primitives';
import { WithScrollButtons } from '@vx/libs/ui/touch-controls';
import { Button } from '@vx/libs/ui/buttons';
import { appStrings } from '@vx/libs/ui/ui_strings/ui_string';
import { AudioOnly, ReadOnLoad } from '@vx/libs/ui/ui_strings';
import {
  PageNavigationButtonId,
  AssistiveTechInstructions,
} from '@vx/libs/ui/accessible_controllers';

import { assert, assertDefined } from '@vx/libs/basics/assert';
import { VoterScreen, Review } from '@vx/libs/mark-flow-ui/src';
import {
  getElectionRecord,
  getInterpretation,
  invalidateBallot,
  validateBallot,
} from '../../api/api';

import { BallotContext } from '../../contexts/ballot_context';

const ContentHeader = styled(ReadOnLoad)`
  padding: 0.5rem 0.75rem 0;
`;

export function ValidateBallotPage(): JSX.Element | null {
  const getInterpretationQuery = getInterpretation.useQuery();
  const getElectionRecordQuery = getElectionRecord.useQuery();
  // We use the contest data stored in BallotContext but vote data from the interpreted ballot
  const { contests, precinctId, resetBallot } = React.useContext(BallotContext);

  assert(
    typeof precinctId !== 'undefined',
    'precinctId is required to render ValidateBallotPage'
  );

  const invalidateBallotMutation = invalidateBallot.useMutation();
  const validateBallotMutation = validateBallot.useMutation();
  function invalidateBallotCallback() {
    invalidateBallotMutation.mutate(undefined);
  }
  function validateBallotCallback() {
    validateBallotMutation.mutate(undefined, {
      onSuccess() {
        resetBallot(true);
      },
    });
  }

  if (!getInterpretationQuery.isSuccess || !getElectionRecordQuery.isSuccess) {
    return null;
  }
  const { electionDefinition } = assertDefined(getElectionRecordQuery.data);

  // Interpretation may be null on first redirect to this page
  const interpretation = getInterpretationQuery.data;
  if (!interpretation) {
    return null;
  }

  assert(interpretation.type === 'InterpretedBmdPage');
  const { votes } = interpretation;

  return (
    <VoterScreen
      actionButtons={
        <React.Fragment>
          <Button
            id={PageNavigationButtonId.PREVIOUS}
            variant="danger"
            onPress={invalidateBallotCallback}
          >
            {appStrings.buttonBallotIsIncorrect()}
          </Button>
          <Button
            id={PageNavigationButtonId.NEXT_AFTER_CONFIRM}
            onPress={validateBallotCallback}
          >
            {appStrings.buttonBallotIsCorrect()}
            <AudioOnly>
              <AssistiveTechInstructions
                controllerString={appStrings.instructionsBmdConfirmCastingBallot()}
                patDeviceString={appStrings.instructionsBmdConfirmCastingBallotPatDevice()}
              />
            </AudioOnly>
          </Button>
        </React.Fragment>
      }
    >
      <ContentHeader>
        <H1>{appStrings.titleBmdReviewScreen()}</H1>
        <P>{appStrings.instructionsBmdReviewAndValidatePrintedBallot()}</P>
        <AudioOnly>
          <AssistiveTechInstructions
            controllerString={appStrings.instructionsBmdReviewPageNavigation()}
            patDeviceString={appStrings.instructionsBmdReviewPageNavigationPatDevice()}
          />{' '}
          <AssistiveTechInstructions
            controllerString={appStrings.instructionsBmdScanReviewConfirmation()}
            patDeviceString={appStrings.instructionsBmdScanReviewConfirmationPatDevice()}
          />
        </AudioOnly>
      </ContentHeader>
      <WithScrollButtons>
        <Review
          election={electionDefinition.election}
          contests={contests}
          precinctId={precinctId}
          votes={votes}
          selectionsAreEditable={false}
        />
      </WithScrollButtons>
    </VoterScreen>
  );
}
