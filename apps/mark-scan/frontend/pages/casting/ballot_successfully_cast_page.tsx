import { Icons, P } from '@vx/libs/ui/primitives';
import { appStrings } from '@vx/libs/ui/ui_strings/ui_string';
import { CenteredCardPageLayout } from '../../components/centered_card_page_layout';

export function BallotSuccessfullyCastPage(): JSX.Element {
  return (
    <CenteredCardPageLayout
      icon={<Icons.Done color="success" />}
      title={appStrings.titleBallotSuccessfullyCastPage()}
      voterFacing
    >
      <P align="left">{appStrings.noteThankYouForVoting()}</P>
    </CenteredCardPageLayout>
  );
}
