import { Main, Screen, Text, H1, P } from '@vx/libs/ui/src';
import { appStrings } from '@vx/libs/ui/src/ui_strings';

export function NoPaperHandlerPage(): JSX.Element {
  return (
    <Screen>
      <Main padded centerChild>
        <Text center>
          <H1>Internal Connection Problem</H1>
          <P>{appStrings.instructionsBmdAskForRestart()}</P>
        </Text>
      </Main>
    </Screen>
  );
}
