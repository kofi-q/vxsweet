/* eslint-disable vx/gts-no-public-class-fields */
jest.mock('pcsc-mini', () => ({
  ...jest.requireActual('pcsc-mini'),
  Client: jest.fn(),
}));

import { Buffer } from 'node:buffer';
import * as pcsc from 'pcsc-mini';

import {
  CardCommand,
  GET_RESPONSE,
  MAX_COMMAND_APDU_DATA_LENGTH,
  MAX_RESPONSE_APDU_DATA_LENGTH,
  ResponseApduError,
  STATUS_WORD,
} from '../apdu/apdu';
import { CardReader } from './card_reader';
import { EventEmitter } from 'node:stream';
import { sleep } from '@vx/libs/basics/async';

class MockClient extends EventEmitter {
  start = () => this;
  stop = jest.fn();
}
const mockClient = new MockClient() as unknown as jest.Mocked<pcsc.Client>;

const mockPcscErr: pcsc.Err = {
  code: 'SomethingWentWrong',
  message: 'something went wrong',
  name: 'Error',
};

class MockReader extends EventEmitter {
  connect = jest.fn();
}
const mockReader = new MockReader() as unknown as jest.Mocked<pcsc.Reader>;

const mockCard = {
  disconnect: jest.fn(),
  transmit: jest.fn(),
} as unknown as jest.Mocked<pcsc.Card>;

const onReaderStatusChange = jest.fn();

function newStatus(...flags: pcsc.ReaderStatus[]) {
  let mask = 0;
  for (const flag of flags) mask |= flag;

  return new pcsc.ReaderStatusFlags(mask);
}

const emptyAtr = Uint8Array.of();

beforeEach(() => {
  jest.mocked(pcsc.Client).mockReturnValue(mockClient);
  mockReader.connect.mockResolvedValue(mockCard);
});

const simpleCommand = {
  command: new CardCommand({ ins: 0x01, p1: 0x02, p2: 0x03 }),
  buffer: Buffer.of(0x00, 0x01, 0x02, 0x03, 0x00),
} as const;
const commandWithLotsOfData = {
  command: new CardCommand({
    ins: 0x01,
    p1: 0x02,
    p2: 0x03,
    data: Buffer.alloc(MAX_COMMAND_APDU_DATA_LENGTH * 2 + 10),
  }),
  buffers: [
    Buffer.concat([
      Buffer.of(0x10, 0x01, 0x02, 0x03, MAX_COMMAND_APDU_DATA_LENGTH),
      Buffer.alloc(MAX_COMMAND_APDU_DATA_LENGTH),
    ]),
    Buffer.concat([
      Buffer.of(0x10, 0x01, 0x02, 0x03, MAX_COMMAND_APDU_DATA_LENGTH),
      Buffer.alloc(MAX_COMMAND_APDU_DATA_LENGTH),
    ]),
    Buffer.concat([
      Buffer.of(0x00, 0x01, 0x02, 0x03, 0x0a /* 10 in hex */),
      Buffer.alloc(10),
    ]),
  ],
} as const;

async function newCardReader(
  startingStatus: 'default' | 'ready' = 'default'
): Promise<CardReader> {
  const cardReader = new CardReader({ onReaderStatusChange });

  if (startingStatus === 'ready') {
    mockClient.emit('reader', mockReader);
    mockReader.connect.mockResolvedValueOnce(mockCard);
    mockReader.emit('change', newStatus(pcsc.ReaderStatus.PRESENT), emptyAtr);
    await sleep(0);
    expect(onReaderStatusChange).toHaveBeenNthCalledWith(1, 'ready');
    onReaderStatusChange.mockClear();
  }

  return cardReader;
}

async function emitStatus(...flags: pcsc.ReaderStatus[]) {
  mockReader.emit('change', newStatus(...flags), emptyAtr);
  await sleep(0);
}

test('CardReader status changes', async () => {
  const reader = await newCardReader();

  mockClient.emit('error', mockPcscErr);
  expect(onReaderStatusChange).toHaveBeenCalledTimes(1);
  expect(onReaderStatusChange).toHaveBeenNthCalledWith(1, 'unknown_error');

  mockClient.emit('reader', mockReader);
  mockClient.emit('error', mockPcscErr);
  // Verify that onReaderStatusChange hasn't been called, since the status is
  // still unknown_error
  expect(onReaderStatusChange).toHaveBeenCalledTimes(1);

  mockReader.connect.mockRejectedValueOnce(mockPcscErr);
  await emitStatus(pcsc.ReaderStatus.PRESENT);
  expect(mockReader.connect).toHaveBeenCalledWith(pcsc.CardMode.EXCLUSIVE);
  expect(onReaderStatusChange).toHaveBeenCalledTimes(2);
  expect(onReaderStatusChange).toHaveBeenNthCalledWith(2, 'card_error');

  mockReader.connect.mockResolvedValueOnce(mockCard);
  await emitStatus(pcsc.ReaderStatus.PRESENT);
  expect(mockReader.connect).toHaveBeenCalledWith(pcsc.CardMode.EXCLUSIVE);
  expect(onReaderStatusChange).toHaveBeenCalledTimes(3);
  expect(onReaderStatusChange).toHaveBeenNthCalledWith(3, 'ready');

  mockCard.disconnect.mockResolvedValueOnce();
  await emitStatus(pcsc.ReaderStatus.EMPTY);
  expect(onReaderStatusChange).toHaveBeenCalledTimes(4);
  expect(onReaderStatusChange).toHaveBeenNthCalledWith(4, 'no_card');
  expect(mockCard.disconnect).toHaveBeenCalledTimes(1);

  mockClient.emit('error', mockPcscErr);
  await sleep(0);
  expect(onReaderStatusChange).toHaveBeenCalledTimes(5);
  expect(onReaderStatusChange).toHaveBeenNthCalledWith(5, 'unknown_error');

  mockReader.emit('disconnect');
  await sleep(0);
  expect(onReaderStatusChange).toHaveBeenCalledTimes(6);
  expect(onReaderStatusChange).toHaveBeenNthCalledWith(6, 'no_card_reader');

  await reader.dispose();
});

test('CardReader card disconnect - success', async () => {
  const cardReader = await newCardReader('ready');
  mockCard.disconnect.mockResolvedValueOnce();

  await cardReader.disconnectCard();

  expect(mockCard.disconnect).toHaveBeenCalledTimes(1);

  await cardReader.dispose();
});

test('CardReader card disconnect - error', async () => {
  const cardReader = await newCardReader('ready');
  mockCard.disconnect.mockRejectedValueOnce(mockPcscErr);

  await expect(cardReader.disconnectCard()).rejects.toEqual(mockPcscErr);

  expect(mockCard.disconnect).toHaveBeenCalledTimes(1);

  await cardReader.dispose();
});

test('CardReader command transmission - reader not ready', async () => {
  const cardReader = await newCardReader();

  await expect(cardReader.transmit(simpleCommand.command)).rejects.toThrow(
    'Reader not ready'
  );

  await cardReader.dispose();
});

test('CardReader command transmission - success', async () => {
  const cardReader = await newCardReader('ready');
  mockCard.transmit.mockResolvedValueOnce(
    Buffer.of(STATUS_WORD.SUCCESS.SW1, STATUS_WORD.SUCCESS.SW2)
  );

  expect(await cardReader.transmit(simpleCommand.command)).toEqual(Buffer.of());

  expect(mockCard.transmit).toHaveBeenCalledTimes(1);
  expect(mockCard.transmit).toHaveBeenNthCalledWith(1, simpleCommand.buffer);

  await cardReader.dispose();
});

test('CardReader command transmission - response APDU with error status word', async () => {
  const cardReader = await newCardReader('ready');
  mockCard.transmit.mockResolvedValueOnce(
    Buffer.of(STATUS_WORD.FILE_NOT_FOUND.SW1, STATUS_WORD.FILE_NOT_FOUND.SW2)
  );

  await expect(cardReader.transmit(simpleCommand.command)).rejects.toThrow(
    new ResponseApduError([
      STATUS_WORD.FILE_NOT_FOUND.SW1,
      STATUS_WORD.FILE_NOT_FOUND.SW2,
    ])
  );

  expect(mockCard.transmit).toHaveBeenCalledTimes(1);
  expect(mockCard.transmit).toHaveBeenNthCalledWith(1, simpleCommand.buffer);

  await cardReader.dispose();
});

test('CardReader command transmission - response APDU with no status word', async () => {
  const cardReader = await newCardReader('ready');
  mockCard.transmit.mockResolvedValueOnce(Buffer.of());

  await expect(cardReader.transmit(simpleCommand.command)).rejects.toThrow();

  expect(mockCard.transmit).toHaveBeenCalledTimes(1);
  expect(mockCard.transmit).toHaveBeenNthCalledWith(1, simpleCommand.buffer);

  await cardReader.dispose();
});

test('CardReader command transmission - chained command', async () => {
  const cardReader = await newCardReader('ready');
  mockCard.transmit.mockResolvedValueOnce(
    Buffer.of(STATUS_WORD.SUCCESS.SW1, STATUS_WORD.SUCCESS.SW2)
  );
  mockCard.transmit.mockResolvedValueOnce(
    Buffer.of(STATUS_WORD.SUCCESS.SW1, STATUS_WORD.SUCCESS.SW2)
  );
  mockCard.transmit.mockResolvedValueOnce(
    Buffer.of(0x00, STATUS_WORD.SUCCESS.SW1, STATUS_WORD.SUCCESS.SW2)
  );

  expect(await cardReader.transmit(commandWithLotsOfData.command)).toEqual(
    Buffer.of(0x00)
  );

  expect(mockCard.transmit).toHaveBeenCalledTimes(3);
  expect(mockCard.transmit).toHaveBeenNthCalledWith(
    1,
    commandWithLotsOfData.buffers[0]
  );
  expect(mockCard.transmit).toHaveBeenNthCalledWith(
    2,
    commandWithLotsOfData.buffers[1]
  );
  expect(mockCard.transmit).toHaveBeenNthCalledWith(
    3,
    commandWithLotsOfData.buffers[2]
  );

  await cardReader.dispose();
});

test('CardReader command transmission - chained response', async () => {
  const cardReader = await newCardReader('ready');
  mockCard.transmit.mockResolvedValueOnce(
    Buffer.concat([
      Buffer.alloc(MAX_RESPONSE_APDU_DATA_LENGTH, 1),
      Buffer.of(STATUS_WORD.SUCCESS_MORE_DATA_AVAILABLE.SW1, 10),
    ])
  );
  mockCard.transmit.mockResolvedValueOnce(
    Buffer.concat([
      Buffer.alloc(10, 2),
      Buffer.of(STATUS_WORD.SUCCESS.SW1, STATUS_WORD.SUCCESS.SW2),
    ])
  );

  expect(await cardReader.transmit(simpleCommand.command)).toEqual(
    Buffer.concat([
      Buffer.alloc(MAX_RESPONSE_APDU_DATA_LENGTH, 1),
      Buffer.alloc(10, 2),
    ])
  );

  expect(mockCard.transmit).toHaveBeenCalledTimes(2);
  expect(mockCard.transmit).toHaveBeenNthCalledWith(1, simpleCommand.buffer);
  expect(mockCard.transmit).toHaveBeenNthCalledWith(
    2,
    Buffer.of(0x00, GET_RESPONSE.INS, GET_RESPONSE.P1, GET_RESPONSE.P2, 0x0a)
  );

  await cardReader.dispose();
});

test('CardReader command transmission - transmit failure', async () => {
  const cardReader = await newCardReader('ready');
  mockCard.transmit.mockRejectedValueOnce(mockPcscErr);

  await expect(cardReader.transmit(simpleCommand.command)).rejects.toThrow(
    'Failed to transmit data to card'
  );

  expect(mockCard.transmit).toHaveBeenCalledTimes(1);
  expect(mockCard.transmit).toHaveBeenNthCalledWith(1, simpleCommand.buffer);

  await cardReader.dispose();
});
