import { err, ok, type Result } from '@vx/libs/basics/src';
import { Buffer } from 'node:buffer';
import { type DuplexChannel, ErrorCode, type MaybePromise } from '../types';

/**
 * Listeners for actions on a {@link DuplexChannel}.
 */
export interface DuplexChannelListeners {
  onConnect(): MaybePromise<Result<void, ErrorCode>>;
  onDisconnect(): MaybePromise<void>;
  onRead(maxLength: number): MaybePromise<Result<Buffer, ErrorCode>>;
  onWrite(data: Buffer): MaybePromise<Result<void, ErrorCode>>;
}

/**
 * Creates a basic mock {@link DuplexChannel} for testing.
 */
export function createDuplexChannelMock({
  onConnect,
  onDisconnect,
  onRead,
  onWrite,
}: Partial<DuplexChannelListeners>): DuplexChannel {
  let isConnected = false;

  return {
    async connect() {
      if (isConnected) {
        return ok();
      }

      const result = (await onConnect?.()) ?? ok();
      isConnected = result.isOk();
      return result;
    },

    async disconnect() {
      if (!isConnected) {
        return;
      }

      await onDisconnect?.();
      isConnected = false;
    },

    async read(maxLength) {
      if (!isConnected) {
        return err(ErrorCode.ScannerOffline);
      }

      return (await onRead?.(maxLength)) ?? err(ErrorCode.NoDeviceAnswer);
    },

    async write(data) {
      if (!isConnected) {
        return err(ErrorCode.ScannerOffline);
      }

      return (await onWrite?.(data)) ?? ok();
    },
  };
}
