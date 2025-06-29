import { type UsbDrive } from '@vx/libs/usb-drive/src';
import { LogEventId, Logger } from '@vx/libs/logging/src';
import { MarkScanReadinessReport } from '@vx/libs/ui/diagnostics';
import { type ExportDataResult, Exporter } from '@vx/libs/backend/exporter';
import {
  SCAN_ALLOWED_EXPORT_PATTERNS,
  VX_MACHINE_ID,
} from '@vx/libs/backend/scan_globals';
import { renderToPdf } from '@vx/libs/printing/src';
import { generateReadinessReportFilename } from '@vx/libs/utils/src';
import { type Workspace } from '../util/workspace';
import { getCurrentTime } from '../util/get_current_time';
import {
  getMarkScanBmdModel,
  isAccessibleControllerDaemonRunning,
} from '../util/hardware';
import { type PaperHandlerStateMachine } from '../custom-paper-handler/state_machine';

/**
 * Saves the VxMark hardware readiness report to the USB drive.
 */
export async function saveReadinessReport({
  workspace,
  usbDrive,
  logger,
  stateMachine,
}: {
  workspace: Workspace;
  usbDrive: UsbDrive;
  logger: Logger;
  stateMachine: PaperHandlerStateMachine;
}): Promise<ExportDataResult> {
  const { store } = workspace;
  const generatedAtTime = new Date(getCurrentTime());
  const { electionDefinition, electionPackageHash } =
    store.getElectionRecord() ?? {};
  const precinctSelection = store.getPrecinctSelection();
  const isControllerDaemonRunning = await isAccessibleControllerDaemonRunning(
    workspace.path,
    logger
  );

  // On the BMD 150 a single daemon handles PAT and accessible controller.
  // On the BMD 155 they are separate, but the PAT daemon doesn't report its
  // status in the same way, so we haven't implemented a way to read BMD 155
  // PAT daemon status.
  // As a graceful fallback for the BMD 155, the readiness report reports
  // on PAT device connection (ie. is a sip & puff plugged in?) rather than
  // PAT input availability (ie. is the daemon running and able to query firmware?)
  const isPatAvailable =
    getMarkScanBmdModel() === 'bmd-150'
      ? isControllerDaemonRunning
      : !!stateMachine.isPatDeviceConnected();

  const report = MarkScanReadinessReport({
    diskSpaceSummary: await workspace.getDiskSpaceSummary(),
    accessibleControllerProps: {
      isDeviceConnected: isControllerDaemonRunning,
      mostRecentDiagnosticRecord: store.getMostRecentDiagnosticRecord(
        'mark-scan-accessible-controller'
      ),
    },
    paperHandlerProps: {
      isDeviceConnected: !!(stateMachine.getSimpleStatus() !== 'no_hardware'),
      mostRecentDiagnosticRecord: store.getMostRecentDiagnosticRecord(
        'mark-scan-paper-handler'
      ),
    },
    patInputProps: {
      isDeviceConnected: isPatAvailable,
      mostRecentDiagnosticRecord: store.getMostRecentDiagnosticRecord(
        'mark-scan-pat-input'
      ),
    },
    headphoneInputProps: {
      mostRecentDiagnosticRecord: store.getMostRecentDiagnosticRecord(
        'mark-scan-headphone-input'
      ),
    },
    machineId: VX_MACHINE_ID,
    generatedAtTime,
    electionDefinition,
    electionPackageHash,
    expectPrecinctSelection: true,
    precinctSelection,
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
