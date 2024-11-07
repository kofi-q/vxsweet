import React from 'react';
import { useHistory } from 'react-router-dom';

import { appStrings } from '@vx/libs/ui/ui_strings/ui_string';
import { P } from '@vx/libs/ui/primitives';
import {
  InsertedSmartCardAuth,
  type VotesDict,
} from '@vx/libs/types/elections';

import { AskPollWorkerPage } from '../help/ask_poll_worker_page';
import { RemoveJammedSheetScreen } from './remove_jammed_sheet_screen';

export interface JammedPageProps {
  authStatus:
    | InsertedSmartCardAuth.CardlessVoterLoggedIn
    | InsertedSmartCardAuth.PollWorkerLoggedIn
    | InsertedSmartCardAuth.LoggedOut;
  votes?: VotesDict;
}

export function JammedPage(props: JammedPageProps): JSX.Element {
  const { authStatus, votes } = props;
  const isVotingInProgress = !!votes;

  const history = useHistory();
  React.useEffect(() => {
    if (isVotingInProgress) {
      history.push('/ready-to-review');
    }
  });

  if (authStatus.status === 'logged_out') {
    return <RemoveJammedSheetScreen />;
  }

  return (
    <AskPollWorkerPage
      authStatus={authStatus}
      pollWorkerPage={<RemoveJammedSheetScreen />}
      titleOverride={appStrings.titleBmdJammedScreen()}
    >
      <P>{appStrings.instructionsBmdPaperJam()}</P>
    </AskPollWorkerPage>
  );
}
