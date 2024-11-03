import { appStrings } from '@vx/libs/ui/ui_strings/ui_string';
import { Caption, Icons, P } from '@vx/libs/ui/primitives';

import { CenteredCardPageLayout } from '../../components/centered_card_page_layout';

export function ReinsertedNonBallotScreen(): JSX.Element {
  return (
    <CenteredCardPageLayout
      icon={<Icons.Warning color="warning" />}
      title={appStrings.titleBmdInvalidBallotNoBallotDetected()}
      voterFacing
    >
      <P>
        {appStrings.warningBmdInvalidBallotNoBallotDetected()}{' '}
        {appStrings.instructionsBmdInsertPreviouslyPrintedBallot()}
      </P>
      <P>{appStrings.instructionsBmdInsertBallotFaceUp()}</P>
      <Caption>
        <Icons.Question /> {appStrings.noteAskPollWorkerForHelp()}
      </Caption>
    </CenteredCardPageLayout>
  );
}
