import {
  Caption,
  FullScreenIconWrapper,
  Icons,
  P,
} from '@vx/libs/ui/primitives';
import { appStrings } from '@vx/libs/ui/ui_strings/ui_string';
import { assert, throwIllegalValue } from '@vx/libs/basics/assert';
import {
  type PrecinctScannerErrorType,
  type InvalidInterpretationReason,
} from '@vx/libs/types/scanning';
import { Screen } from '../../components/layout/layout';
import { FullScreenPromptLayout } from '../../components/full-screen-prompt/layout';

export interface Props {
  error?: InvalidInterpretationReason | PrecinctScannerErrorType;
  isTestMode: boolean;
  scannedBallotCount: number;
  restartRequired?: boolean;
}

export function ScanErrorScreen({
  error,
  isTestMode,
  scannedBallotCount,
  restartRequired = false,
}: Props): JSX.Element {
  const errorMessage = (() => {
    if (!error) return undefined;
    assert(
      error !== 'double_feed_calibration_timed_out' && // Only used in double feed calibration
        error !== 'scanner_diagnostic_failed' && // Only used in ScannerDiagnosticScreen
        error !== 'outfeed_blocked' // Only used in ScanJamScreen
    );
    switch (error) {
      // Invalid ballot interpretations
      case 'invalid_test_mode':
        return isTestMode
          ? appStrings.warningScannerOfficialBallotInTestMode()
          : appStrings.warningScannerTestBallotInOfficialMode();
      case 'invalid_ballot_hash':
        return appStrings.warningScannerMismatchedElection();
      case 'invalid_precinct':
        return appStrings.warningScannerMismatchedPrecinct();
      case 'vertical_streaks_detected':
        return appStrings.warningScannerVerticalStreaksDetected();
      case 'unreadable':
      case 'unknown':
        return appStrings.warningProblemScanningBallotScanAgain();
      // Precinct scanner errors
      case 'scanning_failed':
      case 'both_sides_have_paper':
      case 'paper_in_front_after_reconnect':
      case 'paper_in_back_after_reconnect':
      case 'paper_in_back_after_accept':
      case 'paper_in_both_sides_after_reconnect':
        return appStrings.instructionsScannerRemoveBallotToContinue();
      case 'double_feed_detected':
        return appStrings.instructionsScannerRemoveDoubleSheet();
      case 'paper_status_timed_out':
      case 'scanning_timed_out':
      case 'unexpected_paper_status':
      case 'unexpected_event':
      case 'client_error':
        // These cases require restart, so we don't need to show an error
        // message, since that's handled below.
        return undefined;
      default:
        throwIllegalValue(error);
    }
  })();
  return (
    <Screen
      centerContent
      isLiveMode={!isTestMode}
      ballotCountOverride={scannedBallotCount}
      voterFacing
    >
      <FullScreenPromptLayout
        title={appStrings.titleScannerBallotNotCounted()}
        image={
          <FullScreenIconWrapper>
            <Icons.Delete color="danger" />
          </FullScreenIconWrapper>
        }
      >
        <P>{errorMessage}</P>
        {restartRequired ? (
          <P>{appStrings.instructionsScannerAskForRestart()}</P>
        ) : (
          <Caption>{appStrings.noteAskPollWorkerForHelp()}</Caption>
        )}
      </FullScreenPromptLayout>
    </Screen>
  );
}

/* istanbul ignore next */
export function UnreadablePreview(): JSX.Element {
  return (
    <ScanErrorScreen
      isTestMode={false}
      error="unreadable"
      scannedBallotCount={42}
    />
  );
}

/* istanbul ignore next */
export function InvalidBallotHashPreview(): JSX.Element {
  return (
    <ScanErrorScreen
      isTestMode={false}
      error="invalid_ballot_hash"
      scannedBallotCount={42}
    />
  );
}

/* istanbul ignore next */
export function InvalidBallotTestModePreview(): JSX.Element {
  return (
    <ScanErrorScreen
      isTestMode
      error="invalid_test_mode"
      scannedBallotCount={42}
    />
  );
}

/* istanbul ignore next */
export function InvalidBallotPreview(): JSX.Element {
  return (
    <ScanErrorScreen
      isTestMode={false}
      error="invalid_test_mode"
      scannedBallotCount={42}
    />
  );
}

/* istanbul ignore next */
export function InvalidPrecinctPreview(): JSX.Element {
  return (
    <ScanErrorScreen
      isTestMode={false}
      error="invalid_precinct"
      scannedBallotCount={42}
    />
  );
}

/* istanbul ignore next */
export function UnknownInterpretationErrorPreview(): JSX.Element {
  return (
    <ScanErrorScreen
      isTestMode={false}
      error="unknown"
      scannedBallotCount={42}
    />
  );
}

/* istanbul ignore next */
export function BallotInsertedWhileOtherBallotAlreadyScanningPreview(): JSX.Element {
  return (
    <ScanErrorScreen
      isTestMode={false}
      error="both_sides_have_paper"
      scannedBallotCount={42}
    />
  );
}

/* istanbul ignore next */
export function AfterReconnectBallotInFrontPreview(): JSX.Element {
  return (
    <ScanErrorScreen
      isTestMode={false}
      error="paper_in_front_after_reconnect"
      scannedBallotCount={42}
    />
  );
}

/* istanbul ignore next */
export function AfterReconnectBallotInBackPreview(): JSX.Element {
  return (
    <ScanErrorScreen
      isTestMode={false}
      error="paper_in_back_after_reconnect"
      scannedBallotCount={42}
    />
  );
}

/* istanbul ignore next */
export function BallotNotDroppedAfterAcceptPreview(): JSX.Element {
  return (
    <ScanErrorScreen
      isTestMode={false}
      error="paper_in_back_after_accept"
      scannedBallotCount={42}
    />
  );
}

/* istanbul ignore next */
export function UnexpectedScannerErrorPreview(): JSX.Element {
  return (
    <ScanErrorScreen
      isTestMode={false}
      error="client_error"
      scannedBallotCount={42}
    />
  );
}
