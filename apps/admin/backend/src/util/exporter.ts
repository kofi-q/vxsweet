import { Exporter } from '@vx/libs/backend/src';
import { type UsbDrive } from '@vx/libs/usb-drive/src';
import { ADMIN_ALLOWED_EXPORT_PATTERNS } from '../globals';

/**
 * Builds an exporter suitable for saving data to a file or USB drive.
 */
export function buildExporter(usbDrive: UsbDrive): Exporter {
  const exporter = new Exporter({
    allowedExportPatterns: ADMIN_ALLOWED_EXPORT_PATTERNS,
    usbDrive,
  });
  return exporter;
}
