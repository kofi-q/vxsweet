import { InsertedSmartCardAuth } from '@vx/libs/types/elections';
import { InvalidCardScreen as SharedInvalidCardScreen } from '@vx/libs/ui/auth-screens';

import { ScreenMainCenterChild } from '../../components/layout/layout';

export function InvalidCardScreen({
  authStatus,
}: {
  authStatus: InsertedSmartCardAuth.LoggedOut;
}): JSX.Element {
  return (
    <ScreenMainCenterChild infoBarMode="pollworker" voterFacing={false}>
      <SharedInvalidCardScreen
        reasonAndContext={authStatus}
        recommendedAction="Remove the card to continue."
      />
    </ScreenMainCenterChild>
  );
}

/* istanbul ignore next */
export function DefaultPreview(): JSX.Element {
  return (
    <InvalidCardScreen
      authStatus={{ status: 'logged_out', reason: 'invalid_user_on_card' }}
    />
  );
}
