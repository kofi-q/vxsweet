import { Main, Screen, Text, H1, P, appStrings } from '@vx/libs/ui/src';

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
