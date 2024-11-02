import { Caption, FullScreenIconWrapper, Icons, P } from '@vx/libs/ui/src';
import { appStrings } from '@vx/libs/ui/src/ui_strings';
import { Screen } from '../../components/layout/layout';
import { FullScreenPromptLayout } from '../../components/full-screen-prompt/layout';

export function ScanBusyScreen(): JSX.Element {
  return (
    <Screen centerContent voterFacing>
      <FullScreenPromptLayout
        title={appStrings.titleRemoveYourBallot()}
        image={
          <FullScreenIconWrapper>
            <Icons.Warning color="warning" />
          </FullScreenIconWrapper>
        }
      >
        <P>{appStrings.warningScannerAnotherScanInProgress()}</P>
        <Caption>{appStrings.noteAskPollWorkerForHelp()}</Caption>
      </FullScreenPromptLayout>
    </Screen>
  );
}

/* istanbul ignore next */
export function DefaultPreview(): JSX.Element {
  return <ScanBusyScreen />;
}
