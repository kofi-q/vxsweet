import { InsertBallotImage } from '@vx/libs/ui/ballots';
import { P } from '@vx/libs/ui/primitives';
import { appStrings } from '@vx/libs/ui/ui_strings/ui_string';
import { Screen } from '../../components/layout/layout';
import { FullScreenPromptLayout } from '../../components/full-screen-prompt/layout';

interface Props {
  isLiveMode: boolean;
  scannedBallotCount: number;
}

export function InsertBallotScreen({
  isLiveMode,
  scannedBallotCount,
}: Props): JSX.Element {
  return (
    <Screen
      centerContent
      isLiveMode={isLiveMode}
      ballotCountOverride={scannedBallotCount}
      voterFacing
    >
      <FullScreenPromptLayout
        title={appStrings.titleScannerInsertBallotScreen()}
        image={<InsertBallotImage ballotFeedLocation="top" />}
      >
        <P>{appStrings.instructionsScannerInsertBallotScreen()}</P>
      </FullScreenPromptLayout>
    </Screen>
  );
}

/* istanbul ignore next */
export function ZeroBallotsScannedPreview(): JSX.Element {
  return <InsertBallotScreen scannedBallotCount={0} isLiveMode />;
}

/* istanbul ignore next */
export function ManyBallotsScannedPreview(): JSX.Element {
  return <InsertBallotScreen scannedBallotCount={1234} isLiveMode />;
}
