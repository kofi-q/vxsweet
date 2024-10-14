import type { MachineConfig } from '@vx/apps/central-scan/backend/src';
import { LogSource, BaseLogger } from '@vx/libs/logging/src';
import { DippedSmartCardAuth, ElectionDefinition } from '@vx/libs/types/src';
import type { UsbDriveStatus } from '@vx/libs/usb-drive/src';
import { createContext } from 'react';

export interface AppContextInterface {
  usbDriveStatus: UsbDriveStatus;
  machineConfig: MachineConfig;
  electionDefinition?: ElectionDefinition;
  electionPackageHash?: string;
  isTestMode: boolean;
  auth: DippedSmartCardAuth.AuthStatus;
  logger: BaseLogger;
}

const appContext: AppContextInterface = {
  usbDriveStatus: { status: 'no_drive' },
  machineConfig: {
    machineId: '0000',
    codeVersion: '',
  },
  electionDefinition: undefined,
  electionPackageHash: undefined,
  logger: new BaseLogger(LogSource.VxCentralScanFrontend),
  isTestMode: false,
  auth: {
    status: 'logged_out',
    reason: 'machine_locked',
  },
};

export const AppContext = createContext(appContext);
