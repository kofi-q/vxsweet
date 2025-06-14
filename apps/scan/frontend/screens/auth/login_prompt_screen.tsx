import { Screen, Main } from '@vx/libs/ui/screens';
import { InsertCardImage } from '@vx/libs/ui/auth-screens';
import { FullScreenMessage } from '@vx/libs/ui/src';

/**
 * LoginPromptScreen prompts the user to log in when the machine is unconfigured
 * @returns JSX.Element
 */
export function LoginPromptScreen(): JSX.Element {
  return (
    <Screen>
      <Main centerChild>
        <FullScreenMessage
          title="Insert an election manager card to configure VxScan"
          image={<InsertCardImage />}
        />
      </Main>
    </Screen>
  );
}
