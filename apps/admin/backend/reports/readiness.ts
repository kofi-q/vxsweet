import { AdminReadinessReport } from '@vx/libs/ui/diagnostics';
import { type Printer } from '@vx/libs/printing/src/printer';
import { renderToPdf } from '@vx/libs/printing/src';
import { LogEventId, Logger } from '@vx/libs/logging/src';
import { type ExportDataResult, Exporter } from '@vx/libs/backend/exporter';
import { VX_MACHINE_ID } from '@vx/libs/backend/scan_globals';
import { getBatteryInfo } from '@vx/libs/backend/system_call';
import { generateReadinessReportFilename } from '@vx/libs/utils/src';
import { type UsbDrive } from '@vx/libs/usb-drive/src';
import { type Workspace } from '../workspace/workspace';
import { getCurrentTime } from '../util/time/get_current_time';
import { ADMIN_ALLOWED_EXPORT_PATTERNS } from '../globals/globals';

async function getReadinessReport({
  workspace,
  printer,
  generatedAtTime = new Date(getCurrentTime()),
}: {
  workspace: Workspace;
  printer: Printer;
  generatedAtTime?: Date;
}): Promise<JSX.Element> {
  const { store } = workspace;
  const currentElectionId = store.getCurrentElectionId();
  const { electionDefinition, electionPackageHash } =
    (currentElectionId ? store.getElection(currentElectionId) : undefined) ??
    {};

  return AdminReadinessReport({
    batteryInfo:
      (await getBatteryInfo()) ??
      /* istanbul ignore next */
      undefined,
    diskSpaceSummary: await workspace.getDiskSpaceSummary(),
    printerStatus: await printer.status(),
    mostRecentPrinterDiagnostic:
      store.getMostRecentDiagnosticRecord('test-print'),
    machineId: VX_MACHINE_ID,
    generatedAtTime,
    electionDefinition,
    electionPackageHash,
  });
}

/**
 * Saves the VxAdmin hardware readiness report to the USB drive.
 */
export async function saveReadinessReport({
  workspace,
  printer,
  usbDrive,
  logger,
}: {
  workspace: Workspace;
  printer: Printer;
  usbDrive: UsbDrive;
  logger: Logger;
}): Promise<ExportDataResult> {
  const generatedAtTime = new Date(getCurrentTime());
  const report = await getReadinessReport({ workspace, printer });

  // Readiness reports shouldn't be large enough to hit the PDF size limit, so
  // we don't expect rendering the PDF to error
  const data = (await renderToPdf({ document: report })).unsafeUnwrap();
  const exporter = new Exporter({
    usbDrive,
    allowedExportPatterns: ADMIN_ALLOWED_EXPORT_PATTERNS,
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
