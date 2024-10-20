import { InsertedSmartCardAuth } from '@vx/libs/types/src';

import { P, appStrings } from '@vx/libs/ui/src';
import { AskPollWorkerPage } from './ask_poll_worker_page';
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
