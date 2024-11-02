import { InsertedSmartCardAuth } from '@vx/libs/types/src/auth';

import { P } from '@vx/libs/ui/src';
import { appStrings } from '@vx/libs/ui/src/ui_strings';
import { AskPollWorkerPage } from './ask_poll_worker_page';
import { ReplaceBlankSheetPage } from './replace_blank_sheet_page';

interface Props {
  authStatus:
    | InsertedSmartCardAuth.CardlessVoterLoggedIn
    | InsertedSmartCardAuth.PollWorkerLoggedIn;
}

export function BlankPageInterpretationPage({
  authStatus,
}: Props): JSX.Element {
  return (
    <AskPollWorkerPage
      authStatus={authStatus}
      pollWorkerPage={<ReplaceBlankSheetPage />}
    >
      <P>{appStrings.noteBmdInterpretationProblem()}</P>
    </AskPollWorkerPage>
  );
}
