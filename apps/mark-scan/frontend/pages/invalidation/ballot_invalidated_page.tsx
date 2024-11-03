import { InsertedSmartCardAuth } from '@vx/libs/types/src/auth';

import { P } from '@vx/libs/ui/primitives';
import { appStrings } from '@vx/libs/ui/ui_strings/ui_string';
import { AskPollWorkerPage } from '../help/ask_poll_worker_page';
import { RemoveInvalidatedBallotPage } from './remove_invalidated_ballot_page';

interface Props {
  authStatus:
    | InsertedSmartCardAuth.CardlessVoterLoggedIn
    | InsertedSmartCardAuth.PollWorkerLoggedIn;
  paperPresent: boolean;
}

export function BallotInvalidatedPage({
  authStatus,
  paperPresent,
}: Props): JSX.Element {
  return (
    <AskPollWorkerPage
      authStatus={authStatus}
      pollWorkerPage={
        <RemoveInvalidatedBallotPage paperPresent={paperPresent} />
      }
    >
      <P>{appStrings.instructionsBmdInvalidatedBallot()}</P>
    </AskPollWorkerPage>
  );
}
