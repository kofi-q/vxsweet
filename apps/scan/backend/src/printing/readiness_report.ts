import { UsbDrive } from '@vx/libs/usb-drive/src';
import { LogEventId, Logger } from '@vx/libs/logging/src';
import {
  ExportDataResult,
  Exporter,
  SCAN_ALLOWED_EXPORT_PATTERNS,
  VX_MACHINE_ID,
} from '@vx/libs/backend/src';
import { renderToPdf } from '@vx/libs/printing/src';
import { generateReadinessReportFilename } from '@vx/libs/utils/src';
import { ScanReadinessReport } from '@vx/libs/ui/src';
import { assert } from '@vx/libs/basics/src';
import { Workspace } from '../util/workspace';
import { getCurrentTime } from '../util/get_current_time';
import { Printer } from './printer';
import { PrecinctScannerStateMachine } from '../types';

/**
 * Saves the VxCentralScan hardware readiness report to the USB drive.
 */
export async function saveReadinessReport({
  workspace,
  usbDrive,
  logger,
  printer,
  machine,
}: {
  workspace: Workspace;
  usbDrive: UsbDrive;
  logger: Logger;
  printer: Printer;
  machine: PrecinctScannerStateMachine;
}): Promise<ExportDataResult> {
  const { store } = workspace;
  const generatedAtTime = new Date(getCurrentTime());
  const electionRecord = store.getElectionRecord();
  const markThresholds = store.getSystemSettings()?.markThresholds;
  const printerStatus = await printer.getStatus();
  assert(printerStatus.scheme === 'hardware-v4');
  const report = ScanReadinessReport({
    electionDefinition: electionRecord?.electionDefinition,
    electionPackageHash: electionRecord?.electionPackageHash,
    expectPrecinctSelection: true,
    precinctSelection: store.getPrecinctSelection(),
    diskSpaceSummary: await workspace.getDiskSpaceSummary(),
    scannerStatus: machine.status(),
    mostRecentScannerDiagnostic:
      store.getMostRecentDiagnosticRecord('blank-sheet-scan'),
    printerStatus,
    mostRecentPrinterDiagnostic:
      store.getMostRecentDiagnosticRecord('test-print'),
    mostRecentAudioDiagnostic:
      store.getMostRecentDiagnosticRecord('scan-audio'),
    machineId: VX_MACHINE_ID,
    generatedAtTime,
    markThresholds,
  });

  // Readiness report PDF shouldn't be too long, so we don't expect a render error
  const data = (await renderToPdf({ document: report })).unsafeUnwrap();
  const exporter = new Exporter({
    usbDrive,
    allowedExportPatterns: SCAN_ALLOWED_EXPORT_PATTERNS,
  });
  const exportFileResult = await exporter.exportDataToUsbDrive(
    '.',
    generateReadinessReportFilename({
      generatedAtTime,
      machineId: VX_MACHINE_ID,
    }),
    data
  );

  if (exportFileResult.isOk()) {
    await logger.logAsCurrentRole(LogEventId.ReadinessReportSaved, {
      message: `User saved the equipment readiness report to a USB drive.`,
      disposition: 'success',
    });
  } else {
    await logger.logAsCurrentRole(LogEventId.ReadinessReportSaved, {
      message: `Error while attempting to save the equipment readiness report to a USB drive: ${
        exportFileResult.err().message
      }`,
      disposition: 'failure',
    });
  }

  return exportFileResult;
}
