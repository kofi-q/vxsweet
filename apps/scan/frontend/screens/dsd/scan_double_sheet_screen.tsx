import { Caption, FullScreenIconWrapper, Icons, P } from '@vx/libs/ui/src';
import { appStrings } from '@vx/libs/ui/src/ui_strings';
import { Screen } from '../../components/layout/layout';
import { FullScreenPromptLayout } from '../../components/full-screen-prompt/layout';

interface Props {
  scannedBallotCount: number;
}

export function ScanDoubleSheetScreen({
  scannedBallotCount,
}: Props): JSX.Element {
  return (
    <Screen centerContent ballotCountOverride={scannedBallotCount} voterFacing>
      <FullScreenPromptLayout
        title={appStrings.titleScannerBallotNotCounted()}
        image={
          <FullScreenIconWrapper>
            <Icons.Delete color="danger" />
          </FullScreenIconWrapper>
        }
      >
        <P>{appStrings.warningScannerMultipleSheetsDetected()}</P>
        <P>
          <Caption>{appStrings.instructionsScannerRemoveDoubleSheet()}</Caption>
        </P>
        <P>
          <Caption>{appStrings.noteAskPollWorkerForHelp()}</Caption>
        </P>
      </FullScreenPromptLayout>
    </Screen>
  );
}

/* istanbul ignore next */
export function DefaultPreview(): JSX.Element {
  return <ScanDoubleSheetScreen scannedBallotCount={42} />;
}
