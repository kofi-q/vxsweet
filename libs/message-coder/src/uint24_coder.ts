import { type Result, ok, resultBlock } from '@vx/libs/basics/src';
import { Buffer } from 'node:buffer';
import { MAX_UINT24, MIN_UINT24 } from './constants';
import {
  type BitOffset,
  type Coder,
  type CoderError,
  type DecodeResult,
  type EncodeResult,
  type Uint24,
} from './types';
import { UintCoder } from './uint_coder';

/**
 * Coder for a uint24, aka a 24-bit unsigned integer. Uses little-endian byte
 * order.
 */
export class Uint24Coder extends UintCoder {
  bitLength(): Result<Uint24, CoderError> {
    return ok(24);
  }

  protected minValue = MIN_UINT24;
  protected maxValue = MAX_UINT24;

  encodeInto(
    value: Uint24,
    buffer: Buffer,
    bitOffset: BitOffset
  ): EncodeResult {
    return resultBlock((fail) => {
      this.validateValue(value).okOrElse(fail);

      return this.encodeUsing(buffer, bitOffset, (byteOffset) => {
        const nextOffset = buffer.writeUInt16LE(value & 0xffff, byteOffset);
        return buffer.writeUInt8((value >> 16) & 0xff, nextOffset);
      });
    });
  }

  decodeFrom(buffer: Buffer, bitOffset: BitOffset): DecodeResult<Uint24> {
    return this.decodeUsing(buffer, bitOffset, (byteOffset) => {
      const low = buffer.readUInt16LE(byteOffset);
      const high = buffer.readUInt8(byteOffset + 2);
      return this.validateValue((high << 16) | low);
    });
  }
}

/**
 * Builds 24-bit unsigned integer coders. Uses little-endian byte order.
 */
export function uint24<T extends number = Uint24>(
  enumeration?: unknown
): Coder<T> {
  return new Uint24Coder(enumeration) as unknown as Coder<T>;
}
