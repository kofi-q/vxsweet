import { appStrings } from '@vx/libs/ui/ui_strings/ui_string';
import { Caption, Icons, P } from '@vx/libs/ui/primitives';

import { CenteredCardPageLayout } from '../../components/centered_card_page_layout';

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
