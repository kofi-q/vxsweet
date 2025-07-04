import { CenteredLargeProse } from '@vx/libs/ui/src';
import { PowerDownButton } from '@vx/libs/ui/system-controls';
import { H1, P } from '@vx/libs/ui/primitives';
import { appStrings } from '@vx/libs/ui/ui_strings/ui_string';
import { type PrinterStatus } from '../../../backend/printing/printer';
import { ScreenMainCenterChild } from '../../components/layout/layout';

function PrinterErrorMessage({
  printerStatus,
}: {
  printerStatus: PrinterStatus;
}): JSX.Element | null {
  /* istanbul ignore next - unreachable safety check */
  if (printerStatus.scheme === 'hardware-v3') {
    return null;
  }
  /* istanbul ignore next - unreachable safety check */
  if (printerStatus.state !== 'error') {
    return null;
  }
  return printerStatus.type === 'disconnected'
    ? appStrings.notePrinterDisconnected()
    : appStrings.notePrinterHardwareError();
}
interface Props {
  scannedBallotCount?: number;
  printerStatus: PrinterStatus;
  isScannerConnected: boolean;
  isPollWorkerAuth: boolean;
}

export function InternalConnectionProblemScreen({
  scannedBallotCount,
  printerStatus,
  isScannerConnected,
  isPollWorkerAuth,
}: Props): JSX.Element {
  // Only support v4 hardware for showing connection status errors.
  const isPrinterConnectedSuccessfully = !(
    printerStatus.scheme === 'hardware-v4' && printerStatus.state === 'error'
  );
  return (
    <ScreenMainCenterChild ballotCountOverride={scannedBallotCount} voterFacing>
      <CenteredLargeProse>
        <H1>{appStrings.titleInternalConnectionProblem()}</H1>
        {!isScannerConnected && <P>{appStrings.noteScannerDisconnected()}</P>}
        {!isPrinterConnectedSuccessfully && (
          <P>
            <PrinterErrorMessage printerStatus={printerStatus} />
          </P>
        )}
        <P>
          {isPollWorkerAuth ? (
            <P>
              <PowerDownButton variant="primary" />
            </P>
          ) : (
            appStrings.instructionsAskForHelp()
          )}
        </P>
      </CenteredLargeProse>
    </ScreenMainCenterChild>
  );
}

/* istanbul ignore next */
export function PrinterDisconnectedPreview(): JSX.Element {
  return (
    <InternalConnectionProblemScreen
      isPollWorkerAuth={false}
      isScannerConnected
      printerStatus={{
        scheme: 'hardware-v4',
        state: 'error',
        type: 'disconnected',
      }}
      scannedBallotCount={42}
    />
  );
}

export function PrinterHardwareErrorPreview(): JSX.Element {
  return (
    <InternalConnectionProblemScreen
      isPollWorkerAuth={false}
      isScannerConnected
      printerStatus={{
        scheme: 'hardware-v4',
        state: 'error',
        type: 'receive-data',
      }}
      scannedBallotCount={42}
    />
  );
}

/* istanbul ignore next */
export function ScannerDisconnectedPreview(): JSX.Element {
  return (
    <InternalConnectionProblemScreen
      isPollWorkerAuth={false}
      isScannerConnected={false}
      printerStatus={{ scheme: 'hardware-v4', state: 'idle' }}
      scannedBallotCount={42}
    />
  );
}

/* istanbul ignore next */
export function ScannerDisconnectedPollWorkerPreview(): JSX.Element {
  return (
    <InternalConnectionProblemScreen
      isPollWorkerAuth
      isScannerConnected={false}
      printerStatus={{ scheme: 'hardware-v4', state: 'idle' }}
      scannedBallotCount={42}
    />
  );
}

/* istanbul ignore next */
export function PrinterScannerDisconnectedPreview(): JSX.Element {
  return (
    <InternalConnectionProblemScreen
      isPollWorkerAuth={false}
      isScannerConnected={false}
      printerStatus={{
        scheme: 'hardware-v4',
        state: 'error',
        type: 'disconnected',
      }}
      scannedBallotCount={42}
    />
  );
}
