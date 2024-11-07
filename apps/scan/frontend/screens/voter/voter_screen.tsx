import {
  type ElectionDefinition,
  type SystemSettings,
} from '@vx/libs/types/elections';
import { useQueryChangeListener } from '@vx/libs/ui/hooks/use_change_listener';
import { assert, throwIllegalValue } from '@vx/libs/basics/assert';
import { getScannerStatus } from '../../api/api';
import { POLLING_INTERVAL_FOR_SCANNER_STATUS_MS } from '../../config/globals';
import { useSound } from '../../sound/use_sound';
import { InsertBallotScreen } from '../ballots/insert_ballot_screen';
import { ScanBusyScreen } from '../busy/scan_busy_screen';
import { ScanErrorScreen } from '../error/scan_error_screen';
import { ScanJamScreen } from '../jams/scan_jam_screen';
import { ScanProcessingScreen } from '../scanning/scan_processing_screen';
import { ScanReturnedBallotScreen } from '../scanning/scan_returned_ballot_screen';
import { ScanSuccessScreen } from '../scanning/scan_success_screen';
import { ScanWarningScreen } from '../warning/scan_warning_screen';
import { ScanDoubleSheetScreen } from '../dsd/scan_double_sheet_screen';

interface VoterScreenProps {
  electionDefinition: ElectionDefinition;
  systemSettings: SystemSettings;
  isTestMode: boolean;
  isSoundMuted: boolean;
}

export function VoterScreen({
  electionDefinition,
  systemSettings,
  isTestMode,
  isSoundMuted,
}: VoterScreenProps): JSX.Element | null {
  const scannerStatusQuery = getScannerStatus.useQuery({
    refetchInterval: POLLING_INTERVAL_FOR_SCANNER_STATUS_MS,
  });

  // Play sounds for scan result events
  const playSuccess = useSound('success');
  const playWarning = useSound('warning');
  const playError = useSound('error');
  useQueryChangeListener(scannerStatusQuery, {
    select: ({ state }) => state,
    onChange: (newScannerState) => {
      if (isSoundMuted) return;
      switch (newScannerState) {
        case 'accepted': {
          playSuccess();
          break;
        }

        case 'needs_review':
        case 'both_sides_have_paper': {
          playWarning();
          break;
        }

        case 'rejecting':
        case 'jammed':
        case 'double_sheet_jammed':
        case 'unrecoverable_error': {
          playError();
          break;
        }

        default: {
          // No sound
          break;
        }
      }
    },
  });

  if (!scannerStatusQuery.isSuccess) {
    return null;
  }
  const scannerStatus = scannerStatusQuery.data;

  // These states are handled in AppRoot since they should show a message for
  // all user types, not just voters.
  assert(scannerStatus.state !== 'disconnected');
  assert(scannerStatus.state !== 'cover_open');
  // These states are handled in AppRoot because once calibration starts, it
  // can't be canceled (even by auth change).
  assert(
    scannerStatus.state !== 'calibrating_double_feed_detection.double_sheet' &&
      scannerStatus.state !==
        'calibrating_double_feed_detection.single_sheet' &&
      scannerStatus.state !== 'calibrating_double_feed_detection.done'
  );

  switch (scannerStatus.state) {
    // This state should pass quickly, so we don't show a message
    case 'connecting':
      return null;
    // When a user (e.g. poll worker) removes their card, there may be a slight
    // delay between when the auth status changes and the scanner returns to
    // no_paper, so we may see the `paused` or `scanner_diagnostic` states here
    // briefly.
    case 'paused':
    case 'scanner_diagnostic.running':
    case 'scanner_diagnostic.done':
    case 'no_paper':
      return (
        <InsertBallotScreen
          isLiveMode={!isTestMode}
          scannedBallotCount={scannerStatus.ballotsCounted}
        />
      );
    case 'hardware_ready_to_scan':
    case 'scanning':
    case 'accepting':
    case 'returning_to_rescan':
      return <ScanProcessingScreen />;
    case 'accepted':
      return (
        <ScanSuccessScreen scannedBallotCount={scannerStatus.ballotsCounted} />
      );
    case 'needs_review':
    case 'accepting_after_review':
      assert(scannerStatus.interpretation?.type === 'NeedsReviewSheet');
      return (
        <ScanWarningScreen
          electionDefinition={electionDefinition}
          systemSettings={systemSettings}
          adjudicationReasonInfo={scannerStatus.interpretation.reasons}
        />
      );
    case 'returning':
    case 'returned':
      return <ScanReturnedBallotScreen />;
    case 'rejecting':
    case 'rejected':
      return (
        <ScanErrorScreen
          error={
            scannerStatus.interpretation?.type === 'InvalidSheet'
              ? scannerStatus.interpretation.reason
              : scannerStatus.error
          }
          isTestMode={isTestMode}
          scannedBallotCount={scannerStatus.ballotsCounted}
        />
      );
    case 'jammed':
      return (
        <ScanJamScreen
          error={scannerStatus.error}
          scannedBallotCount={scannerStatus.ballotsCounted}
        />
      );
    case 'double_sheet_jammed':
      return (
        <ScanDoubleSheetScreen
          scannedBallotCount={scannerStatus.ballotsCounted}
        />
      );
    case 'both_sides_have_paper':
      return <ScanBusyScreen />;
    case 'recovering_from_error':
      return <ScanProcessingScreen />;
    case 'unrecoverable_error':
      return (
        <ScanErrorScreen
          error={scannerStatus.error}
          isTestMode={isTestMode}
          scannedBallotCount={scannerStatus.ballotsCounted}
          restartRequired
        />
      );
    /* istanbul ignore next - compile time check for completeness */
    default:
      throwIllegalValue(scannerStatus.state);
  }
}
