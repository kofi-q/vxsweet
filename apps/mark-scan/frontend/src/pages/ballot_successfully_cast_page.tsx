import { Icons, P, appStrings } from '@vx/libs/ui/src';
import { CenteredCardPageLayout } from '../components/centered_card_page_layout';

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
