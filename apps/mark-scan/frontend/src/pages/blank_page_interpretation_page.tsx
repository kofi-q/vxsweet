import { InsertedSmartCardAuth } from '@vx/libs/types/src';

import { P, appStrings } from '@vx/libs/ui/src';
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
