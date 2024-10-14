import { InsertBallotImage, P, appStrings } from '@vx/libs/ui/src';
import { CenteredPageLayout } from '../components/centered_page_layout';

export function CastingBallotPage(): JSX.Element {
  return (
    <CenteredPageLayout voterFacing>
      <InsertBallotImage />
      <P>{appStrings.noteBmdCastingBallot()}</P>
    </CenteredPageLayout>
  );
}
