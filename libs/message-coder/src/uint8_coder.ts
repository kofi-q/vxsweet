import { type Result, ok, resultBlock } from '@vx/libs/basics/src';
import { Buffer } from 'node:buffer';
import { MAX_UINT8, MIN_UINT8 } from './constants';
import {
  type BitLength,
  type BitOffset,
  type Coder,
  type CoderError,
  type DecodeResult,
  type EncodeResult,
  type Uint8,
} from './types';
import { UintCoder } from './uint_coder';

/**
 * Coder for a uint8, aka an 8-bit unsigned integer.
 */
export class Uint8Coder extends UintCoder {
  bitLength(): Result<BitLength, CoderError> {
    return ok(8);
  }

  protected minValue = MIN_UINT8;
  protected maxValue = MAX_UINT8;

  encodeInto(value: Uint8, buffer: Buffer, bitOffset: BitOffset): EncodeResult {
    return resultBlock((fail) => {
      this.validateValue(value).okOrElse(fail);

      return this.encodeUsing(buffer, bitOffset, (byteOffset) =>
        buffer.writeUInt8(value, byteOffset)
      );
    });
  }

  decodeFrom(buffer: Buffer, bitOffset: BitOffset): DecodeResult<Uint8> {
    return this.decodeUsing(buffer, bitOffset, (byteOffset) =>
      this.validateValue(buffer.readUInt8(byteOffset))
    );
  }
}

/**
 * Builds a coder for a uint8.
 */
export function uint8<T extends number = Uint8>(
  enumeration?: unknown
): Coder<T> {
  return new Uint8Coder(enumeration) as unknown as Coder<T>;
}
