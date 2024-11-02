import { Main, Screen } from '@vx/libs/ui/screens';
import { Text, H1, P } from '@vx/libs/ui/primitives';
import { appStrings } from '@vx/libs/ui/ui_strings/ui_string';

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
