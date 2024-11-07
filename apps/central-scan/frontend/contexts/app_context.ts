import { type MachineConfig } from '../../backend/types/types';
import { LogSource } from '@vx/libs/logging/src/base_types';
import { BaseLogger } from '@vx/libs/logging/src';
import {
  DippedSmartCardAuth,
  type ElectionDefinition,
} from '@vx/libs/types/elections';
import { type UsbDriveStatus } from '@vx/libs/usb-drive/src';
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
