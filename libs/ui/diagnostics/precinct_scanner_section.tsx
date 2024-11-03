import {
  type DiagnosticRecord,
  type PrecinctScannerMachineStatus,
} from '@vx/libs/types/src';
import { assert } from '@vx/libs/basics/src';
import { H2, P } from '../primitives/typography';
import { InfoIcon, SuccessIcon, WarningIcon } from './icons';

export interface PrecinctScannerSectionProps {
  scannerStatus: PrecinctScannerMachineStatus;
  mostRecentScannerDiagnostic?: DiagnosticRecord;
  scannerActionChildren?: React.ReactNode;
}

function ScannerStatus({
  scannerStatus,
}: {
  scannerStatus: PrecinctScannerMachineStatus;
}) {
  switch (scannerStatus.state) {
    case 'connecting':
    case 'disconnected':
      return (
        <P>
          <WarningIcon /> The scanner is disconnected. Please contact support.
        </P>
      );
    case 'unrecoverable_error':
      return (
        <P>
          <WarningIcon /> The scanner has experienced an error. Please restart
          the machine.
        </P>
      );
    default:
      return (
        <P>
          <SuccessIcon /> The scanner is connected.
        </P>
      );
  }
}

export function PrecinctScannerSection({
  scannerStatus,
  mostRecentScannerDiagnostic,
  scannerActionChildren,
}: PrecinctScannerSectionProps): JSX.Element {
  if (mostRecentScannerDiagnostic) {
    assert(mostRecentScannerDiagnostic.type === 'blank-sheet-scan');
  }

  return (
    <section>
      <H2>Scanner</H2>
      {scannerActionChildren}
      <ScannerStatus scannerStatus={scannerStatus} />
      {!mostRecentScannerDiagnostic ? (
        <P>
          <InfoIcon /> No test scan on record
        </P>
      ) : mostRecentScannerDiagnostic.outcome === 'fail' ? (
        <P>
          <WarningIcon /> Test scan failed,{' '}
          {new Date(mostRecentScannerDiagnostic.timestamp).toLocaleString()}
        </P>
      ) : (
        <P>
          <SuccessIcon /> Test scan successful,{' '}
          {new Date(mostRecentScannerDiagnostic.timestamp).toLocaleString()}
        </P>
      )}
    </section>
  );
}
