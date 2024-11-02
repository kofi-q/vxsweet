import { FullScreenIconWrapper, Icons, P } from '@vx/libs/ui/primitives';
import { appStrings } from '@vx/libs/ui/ui_strings/ui_string';

import { Screen } from '../../components/layout/layout';
import { FullScreenPromptLayout } from '../../components/full-screen-prompt/layout';

interface Props {
  scannedBallotCount: number;
}

export function ScanSuccessScreen({ scannedBallotCount }: Props): JSX.Element {
  return (
    <Screen centerContent ballotCountOverride={scannedBallotCount} voterFacing>
      <FullScreenPromptLayout
        title={appStrings.titleScannerSuccessScreen()}
        image={
          <FullScreenIconWrapper>
            <Icons.Done color="success" />
          </FullScreenIconWrapper>
        }
      >
        <P>{appStrings.noteThankYouForVoting()}</P>
      </FullScreenPromptLayout>
    </Screen>
  );
}

/* istanbul ignore next */
export function DefaultPreview(): JSX.Element {
  return <ScanSuccessScreen scannedBallotCount={42} />;
}
