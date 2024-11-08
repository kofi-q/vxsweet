import { type InsertedSmartCardAuthApi } from '@vx/libs/auth/inserted-cards';
import { LogEventId, Logger } from '@vx/libs/logging/src';
import { type UsbDrive, detectUsbDrive } from '@vx/libs/usb-drive/src';
import { detectDevices } from '@vx/libs/backend/devices';
import { buildApp } from '../app/app';
import { PORT } from '../globals/globals';
import { type PrecinctScannerStateMachine } from '../types/types';
import { type Workspace } from '../workspace/workspace';
import { type Printer, getPrinter } from '../printing/printer';

export interface StartOptions {
  auth: InsertedSmartCardAuthApi;
  workspace: Workspace;
  logger: Logger;
  port?: number | string;
  precinctScannerStateMachine: PrecinctScannerStateMachine;
  usbDrive?: UsbDrive;
  printer?: Printer;
}

/**
 * Starts the server.
 */
export function start({
  auth,
  workspace,
  logger,
  precinctScannerStateMachine,
  usbDrive,
  printer,
}: StartOptions): void {
  detectDevices({ logger });
  const resolvedUsbDrive = usbDrive ?? detectUsbDrive(logger);
  const resolvedPrinter = printer ?? getPrinter(logger);

  // Clear any cached data
  workspace.clearUploads();

  const app = buildApp({
    auth,
    machine: precinctScannerStateMachine,
    workspace,
    usbDrive: resolvedUsbDrive,
    printer: resolvedPrinter,
    logger,
  });

  app.listen(PORT, async () => {
    void logger.log(LogEventId.ApplicationStartup, 'system', {
      message: `VxScan backend running at http://localhost:${PORT}/`,
      disposition: 'success',
    });

    void logger.log(LogEventId.WorkspaceConfigurationMessage, 'system', {
      message: `Scanning ballots into ${workspace.ballotImagesPath}`,
    });
  });
}
