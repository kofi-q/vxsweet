import { createContext } from 'react';
import { DippedSmartCardAuth } from '@vx/libs/types/src/auth';
import { type ElectionDefinition } from '@vx/libs/types/src';
import { type MachineConfig } from '../../../backend/src/types';
import { type UsbDriveStatus } from '@vx/libs/usb-drive/src';
import { mockUsbDriveStatus } from '@vx/libs/ui/src';
import { type Iso8601Timestamp } from '../config/types';

export interface AppContextInterface {
  electionDefinition?: ElectionDefinition;
  electionPackageHash?: string;
  configuredAt?: Iso8601Timestamp;
  isOfficialResults: boolean;
  usbDriveStatus: UsbDriveStatus;
  auth: DippedSmartCardAuth.AuthStatus;
  machineConfig: MachineConfig;
}

const appContext: AppContextInterface = {
  electionDefinition: undefined,
  electionPackageHash: undefined,
  configuredAt: undefined,
  isOfficialResults: false,
  usbDriveStatus: mockUsbDriveStatus('no_drive'),
  auth: DippedSmartCardAuth.DEFAULT_AUTH_STATUS,
  machineConfig: {
    machineId: '0000',
    codeVersion: 'dev',
  },
};

export const AppContext = createContext(appContext);
