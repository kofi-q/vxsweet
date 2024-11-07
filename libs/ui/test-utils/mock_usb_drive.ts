/* istanbul ignore file */
import { throwIllegalValue } from '@vx/libs/basics/assert';

import { type UsbDriveStatus } from '@vx/libs/usb-drive/src';

export function mockUsbDriveStatus(
  status: UsbDriveStatus['status']
): UsbDriveStatus {
  switch (status) {
    case 'mounted':
      return {
        status,
        mountPoint: 'test-mount-point',
      };
    case 'no_drive':
    case 'ejected':
      return { status };
    case 'error':
      return {
        status,
        reason: 'bad_format',
      };
    default:
      throwIllegalValue(status);
  }
}
