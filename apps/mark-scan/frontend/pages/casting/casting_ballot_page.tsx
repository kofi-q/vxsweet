import { InsertBallotImage } from '@vx/libs/ui/ballots';
import { P } from '@vx/libs/ui/primitives';
import { appStrings } from '@vx/libs/ui/ui_strings/ui_string';
import { CenteredPageLayout } from '../../components/centered_page_layout';

export function CastingBallotPage(): JSX.Element {
  return (
    <CenteredPageLayout voterFacing>
      <InsertBallotImage />
      <P>{appStrings.noteBmdCastingBallot()}</P>
    </CenteredPageLayout>
  );
}
