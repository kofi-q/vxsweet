import { type Result, err, ok } from '@vx/libs/basics/result';
import { sleep } from '@vx/libs/basics/async';
import { type FujitsuThermalPrinterDriverInterface } from './driver/driver';
import { type RawPrinterStatus } from './driver/coders';
import { isErrorStatus, isPrinterStopped } from './driver/status';
import { rootDebug } from './debug';
import { type Uint8 } from './bits';
import { type ErrorType, type PrinterStatus } from './types';

const debug = rootDebug.extend('wait_for_status');

export function getErrorType(status: RawPrinterStatus): ErrorType {
  if (status.temperatureError) {
    return 'temperature';
  }
  if (status.supplyVoltageError) {
    return 'supply-voltage';
  }
  if (status.receiveDataError) {
    return 'receive-data';
  }
  if (status.hardwareError) {
    return 'hardware';
  }

  throw new Error('cannot get ErrorType of a non-error status');
}

export function summarizeRawStatus(status: RawPrinterStatus): PrinterStatus {
  if (isErrorStatus(status)) {
    return { state: 'error', type: getErrorType(status) };
  }

  if (status.isPaperCoverOpen) {
    return { state: 'cover-open' };
  }

  if (status.isPaperAtEnd) {
    return { state: 'no-paper' };
  }

  return { state: 'idle' };
}

export interface WaitForPrintReadyStatusOptions {
  /**
   * The interval, in milliseconds, at which to poll the printer status.
   */
  interval: number;
  /**
   * The timeout, in milliseconds, after which to give up waiting for the printer to be ready.
   */
  timeout: number;

  /**
   * If specified, only a status with the given reply parameter will be considered ready.
   */
  replyParameter?: Uint8;
}

export async function waitForPrintReadyStatus(
  driver: FujitsuThermalPrinterDriverInterface,
  options: WaitForPrintReadyStatusOptions
): Promise<Result<void, RawPrinterStatus>> {
  const status = await driver.getStatus();
  if (isPrinterStopped(status)) {
    debug('error: printer stopped while waiting for print ready status');
    return err(status);
  }

  if (status.isBufferFull) {
    if (options.timeout > 0) {
      debug('buffer full retrying...');
      await sleep(options.interval);
      return waitForPrintReadyStatus(driver, {
        ...options,
        timeout: options.timeout - options.interval,
      });
    }

    debug('error: timed out waiting for buffer to clear');
    return err(status);
  }

  if (
    options.replyParameter !== undefined &&
    options.replyParameter !== status.replyParameter
  ) {
    if (options.timeout > 0) {
      debug('reply parameter not yet correct, retrying...');
      await sleep(options.interval);
      return waitForPrintReadyStatus(driver, {
        ...options,
        timeout: options.timeout - options.interval,
      });
    }

    debug('error: timed out waiting for allowed reply parameter');
    return err(status);
  }

  debug(`printer ready status, reply parameter: ${status.replyParameter}`);
  return ok();
}
