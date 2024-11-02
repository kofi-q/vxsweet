import { InsertedSmartCardAuth } from '@vx/libs/types/src/auth';

import { Button } from '@vx/libs/ui/buttons';
import { Icons, P } from '@vx/libs/ui/primitives';
import { appStrings } from '@vx/libs/ui/ui_strings/ui_string';
import { AskPollWorkerPage } from '../help/ask_poll_worker_page';
import { confirmBallotBoxEmptied } from '../../api/api';
import { CenteredCardPageLayout } from '../../components/centered_card_page_layout';

interface Props {
  authStatus: InsertedSmartCardAuth.AuthStatus;
}

function ConfirmBallotBoxEmptied(): JSX.Element {
  const confirmBallotBoxEmptiedMutation = confirmBallotBoxEmptied.useMutation();

  // No translation - poll worker page
  return (
    <CenteredCardPageLayout
      buttons={
        <Button
          variant="primary"
          onPress={confirmBallotBoxEmptiedMutation.mutate}
        >
          Yes, Ballot Box is Empty
        </Button>
      }
      icon={<Icons.Question />}
      title="Ballot Box Emptied?"
      voterFacing={false}
    >
      <P>Has the full ballot box been emptied?</P>
    </CenteredCardPageLayout>
  );
}

export function EmptyBallotBoxPage({ authStatus }: Props): JSX.Element {
  return (
    <AskPollWorkerPage
      authStatus={authStatus}
      titleOverride={appStrings.titleBallotBoxFull()}
      pollWorkerPage={<ConfirmBallotBoxEmptied />}
    >
      <P>{appStrings.noteBmdBallotBoxIsFull()}</P>
    </AskPollWorkerPage>
  );
}
