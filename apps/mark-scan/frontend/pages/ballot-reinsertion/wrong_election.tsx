import { appStrings } from '@vx/libs/ui/ui_strings/ui_string';
import { Caption, Icons, P } from '@vx/libs/ui/primitives';

import { CenteredCardPageLayout } from '../../components/centered_card_page_layout';

export function ReinsertedWrongElectionBallotScreen(): JSX.Element {
  return (
    <CenteredCardPageLayout
      icon={<Icons.Warning color="warning" />}
      title={appStrings.titleBmdInvalidBallotWrongElection()}
      voterFacing
    >
      <P>{appStrings.warningBmdInvalidBallotWrongElection()}</P>
      <P>{appStrings.instructionsBmdInsertPreviouslyPrintedBallot()}</P>
      <Caption>
        <Icons.Question /> {appStrings.noteAskPollWorkerForHelp()}
      </Caption>
    </CenteredCardPageLayout>
  );
}
