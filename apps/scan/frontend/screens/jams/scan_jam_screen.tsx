import { Caption, FullScreenIconWrapper, Icons, P } from '@vx/libs/ui/src';
import { appStrings } from '@vx/libs/ui/src/ui_strings';
import { type PrecinctScannerErrorType } from '@vx/libs/types/src';
import { Screen } from '../../components/layout/layout';
import { FullScreenPromptLayout } from '../../components/full-screen-prompt/layout';

interface Props {
  error?: PrecinctScannerErrorType;
  scannedBallotCount: number;
}

export function ScanJamScreen({
  error,
  scannedBallotCount,
}: Props): JSX.Element {
  const isOutfeedBlocked = error === 'outfeed_blocked';
  return (
    <Screen centerContent ballotCountOverride={scannedBallotCount} voterFacing>
      <FullScreenPromptLayout
        title={
          isOutfeedBlocked
            ? appStrings.titleScannerOutfeedBlocked()
            : appStrings.titleScannerBallotNotCounted()
        }
        image={
          <FullScreenIconWrapper>
            <Icons.Delete color="danger" />
          </FullScreenIconWrapper>
        }
      >
        {!isOutfeedBlocked && <P>{appStrings.warningScannerJammed()}</P>}
        <Caption>{appStrings.instructionsAskForHelp()}</Caption>
      </FullScreenPromptLayout>
    </Screen>
  );
}

/* istanbul ignore next */
export function DefaultPreview(): JSX.Element {
  return <ScanJamScreen scannedBallotCount={42} />;
}
