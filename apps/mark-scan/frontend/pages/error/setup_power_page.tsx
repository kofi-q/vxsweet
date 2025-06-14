import { Main, Screen } from '@vx/libs/ui/screens';
import { NoWrap, Prose, H1, P } from '@vx/libs/ui/primitives';

export function SetupPowerPage(): JSX.Element {
  return (
    <Screen>
      <Main padded centerChild>
        <Prose textCenter>
          <H1>
            No Power Detected <NoWrap>and Battery is Low</NoWrap>
          </H1>
          <P>
            Please ask a poll worker to plug-in the power cord for this machine.
          </P>
        </Prose>
      </Main>
    </Screen>
  );
}
