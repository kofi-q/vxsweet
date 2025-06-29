import { createImageData, writeImageData } from '@vx/libs/image-utils/src';
import {
  type MockReadable,
  mockReadable,
  type MockWritable,
  mockWritable,
} from '@vx/libs/test-utils/src';
import { type Optional } from '@vx/libs/basics/types';
import { throwIllegalValue } from '@vx/libs/basics/assert';
import { ChildProcess } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { fileSync } from 'tmp';
import {
  type BatchControl,
  type BatchScanner,
  type ScannedSheetInfo,
} from '../../scanners/fujitsu/fujitsu_scanner';

export function makeMock<T>(Cls: new (...args: never[]) => T): jest.Mocked<T> {
  if (!jest.isMockFunction(Cls)) {
    throw new Error(
      `${Cls} is not a mock function; are you missing a jest.mock(…) call?`
    );
  }
  return new Cls();
}

type ScanSessionStep =
  | { type: 'sheet'; sheet: ScannedSheetInfo }
  | { type: 'error'; error: Error };

/**
 * Represents a scanner session, but doesn't actually run anything.
 */
class ScannerSessionPlan {
  private readonly steps: ScanSessionStep[] = [];
  private ended = false;

  getStep(index: number): Optional<ScanSessionStep> {
    return this.steps[index];
  }

  /**
   * Adds a scanning step to the session.
   */
  sheet(sheet: ScannedSheetInfo): this {
    if (this.ended) {
      throw new Error('cannot add a sheet scan step to an ended session');
    }
    this.steps.push({ type: 'sheet', sheet });
    return this;
  }

  /**
   * Adds an error step to the session.
   */
  error(error: Error): this {
    if (this.ended) {
      throw new Error('cannot add an error step to an ended session');
    }
    this.steps.push({ type: 'error', error });
    return this;
  }

  end(): void {
    this.ended = true;
  }

  *[Symbol.iterator](): IterableIterator<ScanSessionStep> {
    if (!this.ended) {
      throw new Error(
        'session has not been ended; please call `session.end()` before using it'
      );
    }

    yield* this.steps;
  }
}

export interface MockScanner extends BatchScanner {
  withNextScannerSession(): ScannerSessionPlan;
}

/**
 * Makes a mock scanner where you can define your own sessions.
 *
 * @example
 *
 * const scanner = makeMockScanner()
 * scanner.withNextScannerSession()
 *   .scan('/path/to/image01.png')
 *   .scan('/path/to/image02.png')
 *   .end()
 *
 * // do something to trigger a scan
 */
export function makeMockScanner(): MockScanner {
  let nextScannerSession: ScannerSessionPlan | undefined;

  return {
    isAttached(): boolean {
      return true;
    },

    async isImprinterAttached(): Promise<boolean> {
      return Promise.resolve(false);
    },

    scanSheets(): BatchControl {
      const session = nextScannerSession;
      nextScannerSession = undefined;
      let stepIndex = 0;

      if (!session) {
        throw new Error(
          'no session registered; call scanner.withNextScannerSession() to define the next session'
        );
      }

      return {
        // eslint-disable-next-line @typescript-eslint/require-await
        scanSheet: async (): Promise<ScannedSheetInfo | undefined> => {
          const step = session.getStep(stepIndex);
          stepIndex += 1;

          if (!step) {
            return undefined;
          }

          switch (step.type) {
            case 'sheet':
              return step.sheet;

            case 'error':
              throw step.error;

            default:
              throwIllegalValue(step);
          }
        },

        // eslint-disable-next-line @typescript-eslint/require-await
        endBatch: async (): Promise<void> => {
          stepIndex = Infinity;
        },
      };
    },

    /**
     * Gets the next scanner session to be used when `scanSheets` is called.
     */
    withNextScannerSession(): ScannerSessionPlan {
      if (!nextScannerSession) {
        nextScannerSession = new ScannerSessionPlan();
      }
      return nextScannerSession;
    },
  };
}

export interface MockChildProcess extends ChildProcess {
  stdin: MockWritable;
  stdout: MockReadable;
  stderr: MockReadable;
}

/**
 * Creates a mock child process with mock streams.
 */
export function makeMockChildProcess(): MockChildProcess {
  const result: Partial<ChildProcess> = {
    pid: Math.floor(Math.random() * 10_000),
    stdin: mockWritable(),
    stdout: mockReadable(),
    stderr: mockReadable(),
  };

  return Object.assign(new EventEmitter(), result) as MockChildProcess;
}

export async function makeImageFile(): Promise<string> {
  const imageFile = fileSync({ postfix: '.png' });
  await writeImageData(
    imageFile.name,
    createImageData(Uint8ClampedArray.of(0, 0, 0), 1, 1)
  );
  return imageFile.name;
}
