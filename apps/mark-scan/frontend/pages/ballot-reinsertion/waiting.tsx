import { appStrings } from '@vx/libs/ui/ui_strings/ui_string';
import { Caption, Icons, P } from '@vx/libs/ui/primitives';

import { CenteredCardPageLayout } from '../../components/centered_card_page_layout';
import { useIsVoterAuth } from '../../hooks/use_is_voter_auth';
import { ResetVoterSessionButton } from '../../components/deactivate_voter_session_button';

export function WaitingForBallotReinsertionBallotScreen(): JSX.Element {
  const isVoterAuth = useIsVoterAuth();

  return (
    <CenteredCardPageLayout
      icon={<Icons.Warning color="warning" />}
      title={appStrings.titleBmdBallotRemovedScreen()}
      voterFacing={isVoterAuth}
      buttons={isVoterAuth ? undefined : <ResetVoterSessionButton />}
    >
      <P>{appStrings.warningBmdBallotRemoved()}</P>
      <P>{appStrings.instructionsBmdReinsertBallot()}</P>
      <Caption>
        <Icons.Question /> {appStrings.noteAskPollWorkerForHelp()}
      </Caption>
    </CenteredCardPageLayout>
  );
}
