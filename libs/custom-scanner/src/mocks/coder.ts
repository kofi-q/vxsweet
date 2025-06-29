/**
 * Creates a mock coder.
 */

import { type Coder } from '@vx/libs/message-coder/src';

/* istanbul ignore next */
function notImplemented() {
  throw new Error('not implemented');
}

/**
 * Creates a mock coder.
 */
export function mockCoder<T>(): jest.Mocked<Coder<T>> {
  // due to overloads, we can't just use jest.Mocked<Coder<T>>
  // but we can at least ensure we use the right keys
  const coder: jest.Mocked<{ [K in keyof Coder<T>]: unknown }> = {
    canEncode: jest.fn().mockImplementation(notImplemented),
    default: jest.fn().mockImplementation(notImplemented),
    bitLength: jest.fn().mockImplementation(notImplemented),
    encode: jest.fn().mockImplementation(notImplemented),
    encodeInto: jest.fn().mockImplementation(notImplemented),
    decode: jest.fn().mockImplementation(notImplemented),
    decodeFrom: jest.fn().mockImplementation(notImplemented),
  };
  return coder as jest.Mocked<Coder<T>>;
}
