import { type UsbDrive } from '@vx/libs/usb-drive/src';
import { LogEventId, Logger } from '@vx/libs/logging/src';
import { CentralScanReadinessReport } from '@vx/libs/ui/diagnostics';
import { type ExportDataResult, Exporter } from '@vx/libs/backend/exporter';
import {
  SCAN_ALLOWED_EXPORT_PATTERNS,
  VX_MACHINE_ID,
} from '@vx/libs/backend/scan_globals';
import { getBatteryInfo } from '@vx/libs/backend/system_call';
import { renderToPdf } from '@vx/libs/printing/src';
import { generateReadinessReportFilename } from '@vx/libs/utils/src';
import { type Workspace } from '../workspace/workspace';
import { getCurrentTime } from '../time/get_current_time';

/**
 * Saves the VxCentralScan hardware readiness report to the USB drive.
 */
export async function saveReadinessReport({
  workspace,
  isScannerAttached,
  usbDrive,
  logger,
}: {
  workspace: Workspace;
  isScannerAttached: boolean;
  usbDrive: UsbDrive;
  logger: Logger;
}): Promise<ExportDataResult> {
  const { store } = workspace;
  const generatedAtTime = new Date(getCurrentTime());
  const { electionDefinition, electionPackageHash } =
    store.getElectionRecord() ?? {};
  const markThresholds = store.getSystemSettings()?.markThresholds;
  const report = CentralScanReadinessReport({
    batteryInfo:
      (await getBatteryInfo()) ?? /* istanbul ignore next */ undefined,
    diskSpaceSummary: await workspace.getDiskSpaceSummary(),
    isScannerAttached,
    mostRecentScannerDiagnostic:
      store.getMostRecentDiagnosticRecord('blank-sheet-scan'),
    machineId: VX_MACHINE_ID,
    generatedAtTime,
    electionDefinition,
    electionPackageHash,
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
    void logger.logAsCurrentRole(LogEventId.ReadinessReportSaved, {
      message: `User saved the equipment readiness report to a USB drive.`,
      disposition: 'success',
    });
  } else {
    void logger.logAsCurrentRole(LogEventId.ReadinessReportSaved, {
      message: `Error while attempting to save the equipment readiness report to a USB drive: ${
        exportFileResult.err().message
      }`,
      disposition: 'failure',
    });
  }

  return exportFileResult;
}
