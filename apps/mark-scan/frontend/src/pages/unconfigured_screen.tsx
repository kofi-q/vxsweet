import {
  Main,
  Screen,
  FullScreenMessage,
  InsertCardImage,
} from '@vx/libs/ui/src';

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
