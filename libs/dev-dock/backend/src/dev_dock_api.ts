import type Express from 'express';
import * as grout from '@vx/libs/grout/src';
import * as fs from 'node:fs';
import { type Optional } from '@vx/libs/basics/types';
import { assert } from '@vx/libs/basics/assert';
import {
  type PrinterConfig,
  type PrinterStatus,
} from '@vx/libs/types/printing';
import { safeParseElectionDefinition } from '@vx/libs/types/election-parsing';
import { type UserRole } from '@vx/libs/types/elections';
import { isAbsolute, join } from 'node:path';
import { type CardStatus } from '@vx/libs/auth/cards';
import { readFromMockFile as readFromCardMockFile } from '@vx/libs/auth/mock-cards';
import {
  isFeatureFlagEnabled,
  BooleanEnvironmentVariableName,
} from '@vx/libs/utils/src';
import { getMockFileUsbDriveHandler } from '@vx/libs/usb-drive/src';
import {
  getMockFileFujitsuPrinterHandler,
  type PrinterStatus as FujitsuPrinterStatus,
} from '@vx/libs/fujitsu-thermal-printer/src';
import {
  BROTHER_THERMAL_PRINTER_CONFIG,
  HP_LASER_PRINTER_CONFIG,
  getMockFilePrinterHandler,
} from '@vx/libs/printing/src/printer';
import { execFile } from './utils';

export type DevDockUserRole = Exclude<UserRole, 'cardless_voter'>;
export type DevDockUsbDriveStatus = 'inserted' | 'removed';
export interface DevDockElectionInfo {
  title: string;
  path: string;
}

export type MachineType =
  | 'mark'
  | 'mark-scan'
  | 'scan'
  | 'central-scan'
  | 'admin';

export const DEFAULT_PRINTERS: Record<MachineType, Optional<PrinterConfig>> = {
  admin: HP_LASER_PRINTER_CONFIG,
  mark: HP_LASER_PRINTER_CONFIG,
  scan: BROTHER_THERMAL_PRINTER_CONFIG,
  'mark-scan': undefined,
  'central-scan': undefined,
};

// Convert paths relative to the VxSuite root to absolute paths
function electionPathToAbsolute(path: string) {
  return isAbsolute(path)
    ? /* istanbul ignore next */
      path
    : join(__dirname, '../../../..', path);
}

const MOCK_CARD_SCRIPT_PATH = join(
  __dirname,
  '../../../auth/scripts/mock-card'
);

export const DEV_DOCK_FILE_PATH = '/tmp/dev-dock.json';
interface DevDockFileContents {
  electionInfo?: DevDockElectionInfo;
}

function writeDevDockFileContents(
  devDockFilePath: string,
  fileContents: DevDockFileContents
): void {
  return fs.writeFileSync(devDockFilePath, JSON.stringify(fileContents));
}

function readDevDockFileContents(devDockFilePath: string): DevDockFileContents {
  return JSON.parse(
    fs.readFileSync(devDockFilePath, { encoding: 'utf-8' })
  ) as DevDockFileContents;
}

function buildApi(devDockFilePath: string, machineType: MachineType) {
  const usbHandler = getMockFileUsbDriveHandler();
  const printerHandler = getMockFilePrinterHandler();
  const fujitsuPrinterHandler = getMockFileFujitsuPrinterHandler();

  return grout.createApi({
    setElection(input: { path: string }): void {
      const electionData = fs.readFileSync(
        electionPathToAbsolute(input.path),
        'utf-8'
      );
      const parseResult = safeParseElectionDefinition(electionData);
      assert(parseResult.isOk());
      const electionInfo: DevDockElectionInfo = {
        path: input.path,
        title: parseResult.ok().election.title,
      };

      writeDevDockFileContents(devDockFilePath, {
        electionInfo,
      });
    },

    getElection(): Optional<DevDockElectionInfo> {
      return readDevDockFileContents(devDockFilePath).electionInfo;
    },

    getCurrentFixtureElectionPaths(): DevDockElectionInfo[] {
      const baseFixturePath = join(__dirname, '../../../../libs/fixtures/data');
      return fs
        .readdirSync(baseFixturePath, {
          withFileTypes: true,
        })
        .filter((item) => item.isDirectory())
        .map((item) => {
          const filesInDir = fs.readdirSync(join(baseFixturePath, item.name));
          const electionFile = filesInDir.find((file) =>
            /^election\.json$/.test(file)
          );
          if (electionFile) {
            return {
              path: join(baseFixturePath, item.name, 'election.json'),
              title: item.name,
            };
          }
          return undefined;
        })
        .filter((item) => item !== undefined);
    },

    getCardStatus(): CardStatus {
      return readFromCardMockFile().cardStatus;
    },

    async insertCard(input: { role: DevDockUserRole }): Promise<void> {
      const { electionInfo } = readDevDockFileContents(devDockFilePath);
      assert(electionInfo !== undefined);

      await execFile(MOCK_CARD_SCRIPT_PATH, [
        '--card-type',
        input.role.replace('_', '-'),
        '--electionDefinition',
        electionPathToAbsolute(electionInfo.path),
      ]);
    },

    async removeCard(): Promise<void> {
      await execFile(MOCK_CARD_SCRIPT_PATH, ['--card-type', 'no-card']);
    },

    getUsbDriveStatus(): DevDockUsbDriveStatus {
      return usbHandler.status().status === 'mounted' ? 'inserted' : 'removed';
    },

    insertUsbDrive(): void {
      usbHandler.insert();
    },

    removeUsbDrive(): void {
      usbHandler.remove();
    },

    clearUsbDrive(): void {
      usbHandler.clearData();
    },

    getPrinterStatus(): PrinterStatus {
      return printerHandler.getPrinterStatus();
    },

    connectPrinter(): void {
      const config = DEFAULT_PRINTERS[machineType];
      assert(config);
      printerHandler.connectPrinter(config);
    },

    disconnectPrinter(): void {
      printerHandler.disconnectPrinter();
    },

    getFujitsuPrinterStatus(): FujitsuPrinterStatus {
      return fujitsuPrinterHandler.getPrinterStatus();
    },

    setFujitsuPrinterStatus(status: FujitsuPrinterStatus): void {
      fujitsuPrinterHandler.setStatus(status);
    },

    getMachineType(): MachineType {
      return machineType;
    },
  });
}

/**
 * A type to be used by the frontend to create a Grout API client
 */
export type Api = ReturnType<typeof buildApi>;

/**
 * Mounts the Dev Dock API endpoints at /dock.
 */
export function useDevDockRouter(
  app: Express.Application,
  express: typeof Express,
  machineType: MachineType,
  /* istanbul ignore next */
  devDockFilePath: string = DEV_DOCK_FILE_PATH
): void {
  if (!isFeatureFlagEnabled(BooleanEnvironmentVariableName.ENABLE_DEV_DOCK)) {
    return;
  }

  // Create dev dock file if it doesn't exist so we can always read from it
  if (!fs.existsSync(devDockFilePath)) {
    fs.writeFileSync(devDockFilePath, '{}');
  }

  const api = buildApi(devDockFilePath, machineType);

  // Set a default election if one is not already set
  if (!api.getElection()) {
    api.setElection({
      path: 'libs/fixtures/data/electionGeneral/election.json',
    });
  }

  const dockRouter = grout.buildRouter(api, express);
  app.use('/dock', dockRouter);
}
