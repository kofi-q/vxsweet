import { Buffer } from 'node:buffer';
import util from 'node:util';
import * as pcsc from 'pcsc-mini';

import { assert } from '@vx/libs/basics/assert';
import { type Byte, isByte } from '@vx/libs/types/basic';

import {
  CardCommand,
  CommandApdu,
  GET_RESPONSE,
  ResponseApduError,
  STATUS_WORD,
} from '../apdu/apdu';
import { BaseLogger, LogEventId } from '@vx/libs/logging/src';

interface ReaderReady {
  card: pcsc.Card;
  status: 'ready';
}

interface ReaderNotReady {
  status:
    | 'card_error'
    | 'connecting'
    | 'no_card_reader'
    | 'no_card'
    | 'unknown_error';
}

type State = ReaderReady | ReaderNotReady;

/**
 * The status of the smart card reader
 */
export type ReaderStatus = State['status'];

/**
 * A on-change handler for reader status changes
 */
export type OnReaderStatusChange = (readerStatus: ReaderStatus) => void;

export type OnFatalError = (err: Error) => void;

/**
 * A class for interfacing with a smart card reader, implemented using PCSC Lite
 */
export class CardReader {
  private readonly onFatalError: OnFatalError;
  private readonly onReaderStatusChange: OnReaderStatusChange;
  private readonly client: pcsc.Client;
  private readonly logger: BaseLogger;
  private state: State;
  private reader?: pcsc.Reader;
  private errorCount = 0;

  constructor(input: {
    logger: BaseLogger;
    onFatalError: OnFatalError;
    onReaderStatusChange: OnReaderStatusChange;
  }) {
    this.logger = input.logger;
    this.onFatalError = input.onFatalError;
    this.onReaderStatusChange = input.onReaderStatusChange;
    this.state = { status: 'no_card_reader' };

    this.client = new pcsc.Client()
      .on('reader', this.onReader)
      .on('error', this.onError)
      .start();
  }

  async dispose(): Promise<void> {
    if (this.state.status === 'ready') {
      const card = this.state.card;
      this.state = { status: 'no_card_reader' };
      await card.disconnect(pcsc.CardDisposition.RESET);
    }

    if (this.reader) this.reader.removeAllListeners();

    this.client.stop();
    this.client.removeAllListeners();
  }

  private readonly onError = async (err: pcsc.Err) => {
    this.errorCount += 1;

    void this.logger.log(LogEventId.UnknownError, 'system', {
      disposition: 'failure',
      message: `Unexpected PC/SC error: ${util.inspect(err)}`,
    });

    this.updateReader({ status: 'unknown_error' });

    const MAX_ERROR_COUNT = 3;
    if (this.errorCount > MAX_ERROR_COUNT) {
      try {
        await this.dispose();
      } catch {
        // ignore
      }

      return this.onFatalError(new Error('Too many PC/SC failures.'));
    }

    this.client.stop();

    void this.logger.log(LogEventId.UnknownError, 'system', {
      disposition: 'failure',
      message: `Restarting PC/SC monitoring after ${this.errorCount} error(s)`,
    });

    this.client.start();
  };

  private readonly onReader = (reader: pcsc.Reader) => {
    this.reader = reader
      .on('change', this.onChange)
      .on('disconnect', this.onDisconnect);
  };

  private readonly onChange = async (status: pcsc.ReaderStatusFlags) => {
    if (!status.has(pcsc.ReaderStatus.PRESENT)) {
      await this.disconnectCard();
      return this.updateReader({ status: 'no_card' });
    }

    if (status.has(pcsc.ReaderStatus.MUTE)) {
      return this.updateReader({ status: 'card_error' });
    }

    if (this.state.status === 'ready' || this.state.status === 'connecting') {
      return;
    }

    this.state = { status: 'connecting' };

    try {
      assert(this.reader);
      const card = await this.reader.connect(pcsc.CardMode.EXCLUSIVE);

      this.updateReader({ status: 'ready', card });
    } catch (err) {
      this.updateReader({ status: 'card_error' });
    }
  };

  private readonly onDisconnect = async () => {
    await this.disconnectCard();
    this.updateReader({ status: 'no_card_reader' });
  };

  /**
   * Disconnects the currently connected card, if any
   */
  async disconnectCard(): Promise<void> {
    if (this.state.status === 'ready') {
      await this.state.card.disconnect(pcsc.CardDisposition.RESET);
    }
  }

  /**
   * Transmits command APDUs to a smart card. On success, returns response data. On error, throws.
   * Specifically throws a ResponseApduError when a response APDU with an error status word is
   * received.
   */
  async transmit(command: CardCommand): Promise<Buffer> {
    const apdus = command.asCommandApdus();
    let data: Buffer = Buffer.of();
    let moreDataAvailable = false;
    let moreDataLength: Byte = 0x00;

    for (const [i, apdu] of apdus.entries()) {
      if (i < apdus.length - 1) {
        // APDUs before the last in a chain
        await this.transmitHelper(apdu);
      } else {
        const response = await this.transmitHelper(apdu);
        data = Buffer.concat([data, response.data]);
        moreDataAvailable = response.moreDataAvailable;
        moreDataLength = response.moreDataLength;
      }
    }

    while (moreDataAvailable) {
      const response = await this.transmitHelper(
        new CommandApdu({
          ins: GET_RESPONSE.INS,
          p1: GET_RESPONSE.P1,
          p2: GET_RESPONSE.P2,
          lc: moreDataLength,
        })
      );
      data = Buffer.concat([data, response.data]);
      moreDataAvailable = response.moreDataAvailable;
      moreDataLength = response.moreDataLength;
    }

    return data;
  }

  private async transmitHelper(apdu: CommandApdu): Promise<{
    data: Buffer;
    moreDataAvailable: boolean;
    moreDataLength: Byte;
  }> {
    if (this.state.status !== 'ready') {
      throw new Error(`Reader not ready: ${this.state.status}`);
    }

    let response: Buffer;
    try {
      const res = await this.state.card.transmit(apdu.asBuffer());
      response = Buffer.from(res.buffer, res.byteOffset, res.length);
    } catch {
      throw new Error('Failed to transmit data to card');
    }

    const data = response.subarray(0, -2);
    const [sw1, sw2] = response.subarray(-2);
    assert(sw1 !== undefined && sw2 !== undefined);
    assert(isByte(sw1) && isByte(sw2));
    if (sw1 === STATUS_WORD.SUCCESS.SW1 && sw2 === STATUS_WORD.SUCCESS.SW2) {
      return { data, moreDataAvailable: false, moreDataLength: 0 };
    }
    if (sw1 === STATUS_WORD.SUCCESS_MORE_DATA_AVAILABLE.SW1) {
      return { data, moreDataAvailable: true, moreDataLength: sw2 };
    }
    throw new ResponseApduError([sw1, sw2]);
  }

  private updateReader(state: State): void {
    const readerStatusChange = this.state.status !== state.status;
    this.state = state;
    if (readerStatusChange) {
      this.onReaderStatusChange(state.status);
    }
  }
}
