import { BaseLogger, LogEventId } from '@vx/libs/logging/src';
import { type PrinterStatus } from './types';

export async function logPrinterStatusIfChanged(
  logger: BaseLogger,
  previousStatus?: PrinterStatus,
  newStatus?: PrinterStatus
): Promise<void> {
  if (!previousStatus && !newStatus) {
    return;
  }
  if (!previousStatus) {
    void logger.log(LogEventId.PrinterStatusChanged, 'system', {
      message: `Printer Status initiated with ${JSON.stringify(newStatus)}`,
      status: JSON.stringify(newStatus),
      disposition:
        newStatus && newStatus.state === 'error' ? 'failure' : 'success',
    });
    return;
  }
  if (!newStatus) {
    void logger.log(LogEventId.PrinterStatusChanged, 'system', {
      message: `Printer status disconnected.`,
      disposition: 'failure',
    });
    return;
  }
  if (previousStatus.state !== newStatus.state) {
    void logger.log(LogEventId.PrinterStatusChanged, 'system', {
      message: `Printer Status updated from ${JSON.stringify(
        previousStatus
      )} to ${JSON.stringify(newStatus)}`,
      status: JSON.stringify(newStatus),
      disposition: newStatus.state === 'error' ? 'failure' : 'success',
    });
  } else if (
    previousStatus.state === 'error' &&
    newStatus.state === 'error' &&
    previousStatus.type !== newStatus.type
  ) {
    void logger.log(LogEventId.PrinterStatusChanged, 'system', {
      message: `Printer Status updated from ${JSON.stringify(
        previousStatus
      )} to ${JSON.stringify(newStatus)}`,
      status: JSON.stringify(newStatus),
      disposition: 'failure',
    });
  }
}
