import { Main } from '../screens/main';
import { Prose } from '../primitives/prose';
import { Screen } from '../screens/screen';
import { fontSizeTheme } from '../themes/themes';
import { H1, P } from '../primitives/typography';

interface Props {
  usePollWorkerLanguage?: boolean;
}

export function SetupCardReaderPage({
  usePollWorkerLanguage = true,
}: Props): JSX.Element {
  const connectMessage = usePollWorkerLanguage
    ? 'Please ask a poll worker to connect card reader.'
    : 'Please connect the card reader to continue.';

  return (
    <Screen>
      <Main centerChild>
        <Prose
          textCenter
          maxWidth={false}
          themeDeprecated={fontSizeTheme.large}
        >
          <H1>Card Reader Not Detected</H1>
          <P>{connectMessage}</P>
        </Prose>
      </Main>
    </Screen>
  );
}
