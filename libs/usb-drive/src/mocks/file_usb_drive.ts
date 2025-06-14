import { Buffer } from 'node:buffer';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { type Optional } from '@vx/libs/basics/types';
import { assert } from '@vx/libs/basics/assert';
import { join, resolve } from 'node:path';
import { type MockFileTree, writeMockFileTree } from './helpers';
import { type UsbDrive, type UsbDriveStatus } from '../types';
import { isIntegrationTest } from '@vx/libs/utils/src';

export const MOCK_USB_DRIVE_STATE_FILENAME = 'mock-usb-state.json';
export const MOCK_USB_DRIVE_DATA_DIRNAME = 'mock-usb-data';

export const DEFAULT_MOCK_USB_DRIVE_DIR = (() => {
  if (isIntegrationTest()) {
    return join(
      process.env.TMPDIR || '/tmp',
      `${process.env.VX_MACHINE_TYPE || 'vx'}-mock-usb`
    );
  }

  return join(process.env.TMPDIR || '/tmp', 'mock-usb');
})();

// When running dev servers via Bazel, use `BUILD_WORKSPACE_DIRECTORY` so that
// dev data gets persisted in the workspace instead of the Bazel output tree:
export const DEV_MOCK_USB_DRIVE_DIR = join(
  process.env.BUILD_WORKSPACE_DIRECTORY || resolve(__dirname, '../../../..'),
  'libs/usb-drive/dev-workspace'
);

export const DEV_MOCK_USB_DRIVE_GLOB_PATTERN = join(
  DEV_MOCK_USB_DRIVE_DIR,
  '**/*'
);

function getMockUsbDirPath(): string {
  if (process.env.NODE_ENV === 'development') {
    return DEV_MOCK_USB_DRIVE_DIR;
  }

  return DEFAULT_MOCK_USB_DRIVE_DIR;
}

interface MockStateFileContents {
  status: UsbDriveStatus;
}

function getMockUsbStateFilePath(): string {
  return join(getMockUsbDirPath(), MOCK_USB_DRIVE_STATE_FILENAME);
}

function getMockUsbDataDirPath(): string {
  return join(getMockUsbDirPath(), MOCK_USB_DRIVE_DATA_DIRNAME);
}

/**
 * Converts a MockFileContents object into a Buffer
 */
function serializeMockFileContents(
  mockStateFileContents: MockStateFileContents
): Buffer {
  return Buffer.from(JSON.stringify(mockStateFileContents), 'utf-8');
}

/**
 * Converts a Buffer created by serializeMockFileContents back into a MockFileContents object
 */
function deserializeMockFileContents(file: Buffer): MockStateFileContents {
  return JSON.parse(file.toString('utf-8'));
}

function writeToMockFile(mockStateFileContents: MockStateFileContents): void {
  mkdirSync(getMockUsbDirPath(), { recursive: true });
  writeFileSync(
    getMockUsbStateFilePath(),
    serializeMockFileContents(mockStateFileContents)
  );
  // Create the data dir whenever we write to the state file, so that it's
  // there before mock mounting
  mkdirSync(getMockUsbDataDirPath(), { recursive: true });
}

export function initializeMockFile(): void {
  writeToMockFile({
    status: {
      status: 'no_drive',
    },
  });
}

/**
 * A helper for readFromMockFile. Returns undefined if the mock file doesn't exist or can't be
 * parsed.
 */
function readFromMockFileHelper(): Optional<MockStateFileContents> {
  const mockFilePath = getMockUsbStateFilePath();
  if (!existsSync(mockFilePath)) {
    return undefined;
  }
  const file = readFileSync(mockFilePath);
  try {
    return deserializeMockFileContents(file);
  } catch {
    return undefined;
  }
}

/**
 * Reads and parses the contents of the file underlying a MockFileUsbDrive
 */
function readFromMockFile(): MockStateFileContents {
  let mockFileContents = readFromMockFileHelper();
  if (!mockFileContents) {
    initializeMockFile();
    mockFileContents = readFromMockFileHelper();
    assert(mockFileContents !== undefined);
  }
  return mockFileContents;
}

/**
 * USB drive initialized in apps that use a temporary file to mock a real drive.
 */
export class MockFileUsbDrive implements UsbDrive {
  status(): Promise<UsbDriveStatus> {
    return Promise.resolve(readFromMockFile().status);
  }

  eject(): Promise<void> {
    const { status } = readFromMockFile();
    if (status.status === 'mounted') {
      writeToMockFile({ status: { status: 'ejected' } });
    }
    return Promise.resolve();
  }

  // mock not fully implemented
  format(): Promise<void> {
    return this.eject();
  }

  sync(): Promise<void> {
    return Promise.resolve();
  }
}

interface MockFileUsbDriveHandler {
  status: () => UsbDriveStatus;
  insert: (contents?: MockFileTree) => void;
  remove: () => void;
  clearData: () => void;
  getDataPath: () => Optional<string>;
  cleanup: () => void;
}

export function getMockFileUsbDriveHandler(): MockFileUsbDriveHandler {
  return {
    status: () => {
      return readFromMockFile().status;
    },
    insert: (contents?: MockFileTree) => {
      if (contents) {
        writeMockFileTree(getMockUsbDataDirPath(), contents);
      }

      writeToMockFile({
        status: {
          status: 'mounted',
          mountPoint: getMockUsbDataDirPath(),
        },
      });
    },
    remove: () => {
      writeToMockFile({
        status: {
          status: 'no_drive',
        },
      });
    },
    clearData: () => {
      rmSync(getMockUsbDataDirPath(), { recursive: true, force: true });
    },
    getDataPath: getMockUsbDataDirPath,
    cleanup: () => {
      rmSync(getMockUsbDirPath(), { recursive: true, force: true });
    },
  };
}
