import { LinkButton } from '@vx/libs/ui/buttons';
import { P, Icons } from '@vx/libs/ui/primitives';
import { appStrings } from '@vx/libs/ui/ui_strings/ui_string';
import { AudioOnly } from '@vx/libs/ui/ui_strings';
import { PageNavigationButtonId } from '@vx/libs/ui/accessible_controllers';
import { CenteredCardPageLayout } from '../../components/centered_card_page_layout';

// This page is rendered as part of the blank ballot interpretation flow immediately after
// the poll worker card is removed. To protect voter privacy, we render this screen first to
// ask the voter to approve before showing ballot selections on screen.
export function ContinueToReviewPage(): JSX.Element {
  return (
    <CenteredCardPageLayout
      icon={<Icons.Info />}
      title={appStrings.titleBmdReadyToReview()}
      buttons={
        <LinkButton
          autoFocus
          to="/review"
          id={PageNavigationButtonId.NEXT}
          variant="primary"
          icon="Done"
        >
          {appStrings.buttonReturnToBallotReview()}
        </LinkButton>
      }
      voterFacing
    >
      <P>{appStrings.noteBmdBallotSheetLoaded()}</P>
      <AudioOnly>{appStrings.instructionsBmdSelectToContinue()}</AudioOnly>
    </CenteredCardPageLayout>
  );
}
