import { Main, Screen } from '@vx/libs/ui/screens';
import { FullScreenMessage } from '@vx/libs/ui/src';
import { InsertCardImage } from '@vx/libs/ui/auth-screens';

export function UnconfiguredScreen(): JSX.Element {
  return (
    <Screen>
      <Main centerChild padded>
        <FullScreenMessage
          title="Insert an election manager card to configure VxMark"
          image={<InsertCardImage />}
        />
      </Main>
    </Screen>
  );
}
