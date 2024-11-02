import { appStrings } from '@vx/libs/ui/src/ui_strings';
import { Caption, Icons, P } from '@vx/libs/ui/src';

import { CenteredCardPageLayout } from '../components/centered_card_page_layout';

export function ReinsertedWrongPrecinctBallotScreen(): JSX.Element {
  return (
    <CenteredCardPageLayout
      icon={<Icons.Warning color="warning" />}
      title={appStrings.titleBmdInvalidBallotWrongPrecinct()}
      voterFacing
    >
      <P>{appStrings.warningBmdInvalidBallotWrongPrecinct()}</P>
      <P>{appStrings.instructionsBmdInsertPreviouslyPrintedBallot()}</P>
      <Caption>
        <Icons.Question /> {appStrings.noteAskPollWorkerForHelp()}
      </Caption>
    </CenteredCardPageLayout>
  );
}
