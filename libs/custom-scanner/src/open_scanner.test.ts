jest.mock('usb');

import { err, ok } from '@vx/libs/basics/result';
import { Device, findByIds, WebUSBDevice } from 'usb';
import { CustomA4Scanner } from './custom_a4_scanner';
import { mockCustomA4ScannerWebUsbDevice } from './mocks/custom_a4_scanner_web_usb_device';
import { openScanner } from './open_scanner';
import { ErrorCode } from './types';

const findByIdsMock = findByIds as jest.MockedFunction<typeof findByIds>;
const createInstanceMock = WebUSBDevice.createInstance as jest.MockedFunction<
  typeof WebUSBDevice.createInstance
>;

test('no Custom A4 device present', async () => {
  findByIdsMock.mockReturnValueOnce(undefined);
  const openScannerResult = await openScanner();
  expect(openScannerResult).toEqual(err(ErrorCode.ScannerOffline));
});

test('unexpected error during open', async () => {
  const legacyDevice = {} as unknown as Device;
  findByIdsMock.mockReturnValueOnce(legacyDevice);
  createInstanceMock.mockRejectedValueOnce(new Error('test'));

  const openScannerResult = await openScanner();
  expect(openScannerResult).toEqual(err(ErrorCode.OpenDeviceError));
});

test('connect success', async () => {
  const legacyDevice = {} as unknown as Device;
  const usbDevice = mockCustomA4ScannerWebUsbDevice();
  findByIdsMock.mockReturnValueOnce(legacyDevice);
  createInstanceMock.mockResolvedValueOnce(
    usbDevice as unknown as WebUSBDevice
  );

  const openScannerResult = await openScanner();
  expect(openScannerResult).toEqual(ok(expect.any(CustomA4Scanner)));
  expect(createInstanceMock).toHaveBeenCalledWith(legacyDevice);
});

test('connect error', async () => {
  const legacyDevice = {} as unknown as Device;
  const usbDevice = mockCustomA4ScannerWebUsbDevice();
  findByIdsMock.mockReturnValueOnce(legacyDevice);
  createInstanceMock.mockResolvedValueOnce(
    usbDevice as unknown as WebUSBDevice
  );

  usbDevice.mockOnOpen(() => {
    throw new Error('test');
  });
  const openScannerResult = await openScanner();
  expect(openScannerResult).toEqual(err(ErrorCode.CommunicationUnknownError));
});
