import { appStrings } from '@vx/libs/ui/src/ui_strings';
import { P } from '@vx/libs/ui/src';
import { InsertedSmartCardAuth } from '@vx/libs/types/src/auth';
import { AskPollWorkerPage } from './ask_poll_worker_page';
import {
  type JamClearedState,
  ReplaceJammedSheetScreen,
} from './replace_jammed_sheet_screen';

export interface JamClearedPageProps {
  authStatus:
    | InsertedSmartCardAuth.CardlessVoterLoggedIn
    | InsertedSmartCardAuth.PollWorkerLoggedIn
    | InsertedSmartCardAuth.LoggedOut;
  stateMachineState: JamClearedState;
}

export function JamClearedPage(props: JamClearedPageProps): JSX.Element {
  const { authStatus, stateMachineState } = props;

  const nonVoterScreen = (
    <ReplaceJammedSheetScreen stateMachineState={stateMachineState} />
  );

  if (authStatus.status === 'logged_out') {
    return nonVoterScreen;
  }

  return (
    <AskPollWorkerPage authStatus={authStatus} pollWorkerPage={nonVoterScreen}>
      <P>{appStrings.noteBmdReloadSheetAfterPaperJam()}</P>
    </AskPollWorkerPage>
  );
}
