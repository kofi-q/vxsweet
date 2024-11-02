import { type PrinterStatus as LegacyPrinterStatus } from '@vx/libs/types/src';
import {
  detectPrinter,
  type Printer as LegacyPrinter,
} from '@vx/libs/printing/src/printer';
import {
  type PrinterStatus as FujitsuPrinterStatus,
  type PrinterState as FujitsuPrinterState,
  type PrintResult as FujitsuPrintResult,
  type ErrorType as FujitsuErrorType,
  type FujitsuThermalPrinterInterface,
  getFujitsuThermalPrinter,
} from '@vx/libs/fujitsu-thermal-printer/src';
import {
  BooleanEnvironmentVariableName,
  isFeatureFlagEnabled,
} from '@vx/libs/utils/src';
import { Logger } from '@vx/libs/logging/src';
import { assert, type Result } from '@vx/libs/basics/src';
import { Buffer } from 'node:buffer';

export type PrinterStatus =
  | ({
      scheme: 'hardware-v3';
    } & LegacyPrinterStatus)
  | ({
      scheme: 'hardware-v4';
    } & FujitsuPrinterStatus);

export type {
  FujitsuErrorType,
  FujitsuPrinterState,
  FujitsuPrinterStatus,
  FujitsuPrintResult,
};

/**
 * An abstraction that wraps old CUPS-based printing and V4 hardware custom driver printing.
 */
export type Printer = {
  getStatus: () => Promise<PrinterStatus>;
} & (
  | {
      scheme: 'hardware-v3';
      print(data: Uint8Array): Promise<void>;
    }
  | {
      scheme: 'hardware-v4';
      print(data: Uint8Array): Promise<Result<void, FujitsuPrinterStatus>>;
    }
);

export type PrintResult =
  | {
      scheme: 'hardware-v3';
      pageCount: number;
    }
  | {
      scheme: 'hardware-v4';
      result: FujitsuPrintResult;
    };

export function wrapLegacyPrinter(legacyPrinter: LegacyPrinter): Printer {
  return {
    scheme: 'hardware-v3',
    print: (data: Uint8Array) =>
      legacyPrinter.print({ data: Buffer.from(data) }),
    getStatus: async () => {
      const legacyStatus = await legacyPrinter.status();
      return {
        scheme: 'hardware-v3',
        ...legacyStatus,
      };
    },
  };
}

export function wrapFujitsuThermalPrinter(
  printer: FujitsuThermalPrinterInterface
): Printer {
  return {
    scheme: 'hardware-v4',
    print: (data: Uint8Array) => printer.print(Buffer.from(data)),
    getStatus: async () => {
      const status = await printer.getStatus();
      return {
        scheme: 'hardware-v4',
        ...status,
      };
    },
  };
}

export function getPrinter(logger: Logger): Printer {
  if (
    isFeatureFlagEnabled(BooleanEnvironmentVariableName.USE_BROTHER_PRINTER)
  ) {
    const legacyPrinter = detectPrinter(logger);
    return wrapLegacyPrinter(legacyPrinter);
  }

  const printer = getFujitsuThermalPrinter(logger);
  assert(printer);
  return wrapFujitsuThermalPrinter(printer);
}
