/* istanbul ignore file - tested via Mark/Mark-Scan */
import styled from 'styled-components';
import { LinkButton } from '@vx/libs/ui/buttons';
import { H1 } from '@vx/libs/ui/primitives';
import { WithScrollButtons } from '@vx/libs/ui/touch-controls';
import { appStrings } from '@vx/libs/ui/ui_strings/ui_string';
import { AudioOnly, ReadOnLoad } from '@vx/libs/ui/ui_strings';
import {
  PageNavigationButtonId,
  AssistiveTechInstructions,
} from '@vx/libs/ui/accessible_controllers';

import { assert } from '@vx/libs/basics/assert';

import {
  type ElectionDefinition,
  type PrecinctId,
  type VotesDict,
} from '@vx/libs/types/src';
import { Review, type ReviewProps } from '../components/review';
import { type ContestsWithMsEitherNeither } from '../utils/ms_either_neither_contests';
import { VoterScreen } from '../components/voter_screen';

const ContentHeader = styled(ReadOnLoad)`
  padding: 0.5rem 0.75rem 0;
`;

export interface ReviewPageProps {
  contests: ContestsWithMsEitherNeither;
  electionDefinition?: ElectionDefinition;
  precinctId?: PrecinctId;
  printScreenUrl: string;
  returnToContest?: ReviewProps['returnToContest'];
  votes: VotesDict;
}

export function ReviewPage(props: ReviewPageProps): JSX.Element {
  const {
    contests,
    electionDefinition,
    precinctId,
    printScreenUrl,
    returnToContest,
    votes,
  } = props;

  assert(
    electionDefinition,
    'electionDefinition is required to render ReviewPage'
  );
  assert(
    typeof precinctId !== 'undefined',
    'precinctId is required to render ReviewPage'
  );

  const printMyBallotButton = (
    <LinkButton
      to={printScreenUrl}
      id={PageNavigationButtonId.NEXT_AFTER_CONFIRM}
      variant="primary"
      icon="Done"
    >
      {appStrings.buttonPrintBallot()}
      <AudioOnly>
        <AssistiveTechInstructions
          controllerString={appStrings.instructionsBmdConfirmPrintingBallot()}
          patDeviceString={appStrings.instructionsBmdConfirmPrintingBallotPatDevice()}
        />
      </AudioOnly>
    </LinkButton>
  );

  return (
    <VoterScreen actionButtons={printMyBallotButton}>
      <ContentHeader>
        <H1>{appStrings.titleBmdReviewScreen()}</H1>
        <AudioOnly>
          <AssistiveTechInstructions
            controllerString={appStrings.instructionsBmdReviewPageNavigation()}
            patDeviceString={appStrings.instructionsBmdReviewPageNavigationPatDevice()}
          />{' '}
          <AssistiveTechInstructions
            controllerString={appStrings.instructionsBmdReviewPageChangingVotes()}
            patDeviceString={appStrings.instructionsBmdReviewPageChangingVotesPatDevice()}
          />
        </AudioOnly>
      </ContentHeader>
      <WithScrollButtons>
        <Review
          election={electionDefinition.election}
          contests={contests}
          precinctId={precinctId}
          votes={votes}
          returnToContest={returnToContest}
        />
      </WithScrollButtons>
    </VoterScreen>
  );
}
