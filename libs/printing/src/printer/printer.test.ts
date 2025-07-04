jest.mock('@vx/libs/utils/src', () => {
  return {
    ...jest.requireActual('@vx/libs/utils/src'),
    isFeatureFlagEnabled: (flag: BooleanEnvironmentVariableName) =>
      featureFlagMock.isEnabled(flag),
  };
});

jest.mock('./configure', (): typeof import('./configure') => ({
  ...jest.requireActual('./configure'),
  configurePrinter: (args) => mockConfigurePrinter(args),
}));

jest.mock('./device_uri', (): typeof import('./device_uri') => ({
  ...jest.requireActual('./device_uri'),
  getConnectedDeviceUris: () => mockGetConnectedDeviceUris(),
}));

jest.mock('./status', (): typeof import('./status') => ({
  ...jest.requireActual('./status'),
  getPrinterRichStatus: () => mockGetPrinterRichStatus(),
}));

import { mockFunction } from '@vx/libs/test-utils/src';
import { LogEventId, mockBaseLogger } from '@vx/libs/logging/src';
import {
  BooleanEnvironmentVariableName,
  getFeatureFlagMock,
} from '@vx/libs/utils/src';
import { type PrinterRichStatus } from '@vx/libs/types/printing';
import { detectPrinter } from './printer';
import {
  BROTHER_THERMAL_PRINTER_CONFIG,
  HP_LASER_PRINTER_CONFIG,
} from './supported';
import { MockFilePrinter } from './mocks/file_printer';

const featureFlagMock = getFeatureFlagMock();

const mockConfigurePrinter = mockFunction('configurePrinter');

const mockGetConnectedDeviceUris = mockFunction('getConnectedDeviceUris');

const mockGetPrinterRichStatus = mockFunction('mockGetPrinterRichStatus');

beforeEach(() => {
  mockConfigurePrinter.reset();
  mockGetConnectedDeviceUris.reset();
  mockGetPrinterRichStatus.reset();
});

afterEach(() => {
  mockConfigurePrinter.assertComplete();
  mockGetConnectedDeviceUris.assertComplete();
  mockGetPrinterRichStatus.assertComplete();
});

test('status and configuration', async () => {
  const logger = mockBaseLogger();
  const printer = detectPrinter(logger);

  // no printer connected
  mockGetConnectedDeviceUris.expectCallWith().returns([]);
  expect(await printer.status()).toEqual({ connected: false });

  const config = BROTHER_THERMAL_PRINTER_CONFIG;
  const supportedPrinterUri1 = `${BROTHER_THERMAL_PRINTER_CONFIG.baseDeviceUri}/serial=1234`;
  const supportedPrinterUri2 = `${HP_LASER_PRINTER_CONFIG.baseDeviceUri}/serial=1234`;
  const unsupportedPrinterUri = 'usb://not-supported';

  // unsupported printer connected
  mockGetConnectedDeviceUris.expectCallWith().returns([unsupportedPrinterUri]);
  expect(await printer.status()).toEqual({ connected: false });
  expect(logger.log).toHaveBeenCalledTimes(0);

  // supported printer connected leads to configure
  mockGetConnectedDeviceUris.expectCallWith().returns([supportedPrinterUri1]);
  mockConfigurePrinter
    .expectCallWith({
      uri: supportedPrinterUri1,
      config: BROTHER_THERMAL_PRINTER_CONFIG,
    })
    .returns(undefined);
  expect(await printer.status()).toEqual({
    connected: true,
    config,
  });
  expect(logger.log).toHaveBeenCalledTimes(1);
  expect(logger.log).toHaveBeenLastCalledWith(
    LogEventId.PrinterConfigurationAdded,
    'system',
    {
      message: 'A supported printer was discovered and configured for use.',
      uri: supportedPrinterUri1,
    }
  );

  // supported printer does not configure again
  mockGetConnectedDeviceUris.expectCallWith().returns([supportedPrinterUri1]);
  expect(await printer.status()).toEqual({
    connected: true,
    config,
  });

  // second printer connected does not change anything
  mockGetConnectedDeviceUris
    .expectCallWith()
    .returns([supportedPrinterUri2, supportedPrinterUri1]);
  expect(await printer.status()).toEqual({
    connected: true,
    config,
  });

  // printer detached is detected
  mockGetConnectedDeviceUris.expectCallWith().returns([]);
  expect(await printer.status()).toEqual({
    connected: false,
  });
  expect(logger.log).toHaveBeenCalledTimes(2);
  expect(logger.log).toHaveBeenLastCalledWith(
    LogEventId.PrinterConfigurationRemoved,
    'system',
    {
      message: 'The previously configured printer is no longer detected.',
      uri: supportedPrinterUri1,
    }
  );
});

test('uses mock file printer when feature flag is set', () => {
  featureFlagMock.enableFeatureFlag(
    BooleanEnvironmentVariableName.USE_MOCK_PRINTER
  );

  const printer = detectPrinter(mockBaseLogger());
  expect(printer).toBeInstanceOf(MockFilePrinter);
  featureFlagMock.resetFeatureFlags();
});

describe('rich status', () => {
  test('does not get rich status if printer is not an IPP printer', async () => {
    const printer = detectPrinter(mockBaseLogger());

    // connect printer
    const uri = `${BROTHER_THERMAL_PRINTER_CONFIG.baseDeviceUri}/serial=1234`;
    const config = BROTHER_THERMAL_PRINTER_CONFIG;
    mockGetConnectedDeviceUris.expectCallWith().returns([uri]);
    mockConfigurePrinter
      .expectCallWith({
        uri,
        config,
      })
      .returns(undefined);
    expect(await printer.status()).toEqual({
      connected: true,
      config,
    });
  });

  test('attempts to get rich status if printer is an IPP printer', async () => {
    const printer = detectPrinter(mockBaseLogger());

    // connect printer
    const uri = `${HP_LASER_PRINTER_CONFIG.baseDeviceUri}/serial=1234`;
    const config = HP_LASER_PRINTER_CONFIG;
    const richStatus: PrinterRichStatus = {
      state: 'idle',
      stateReasons: ['none'],
      markerInfos: [],
    };
    mockGetConnectedDeviceUris.expectCallWith().returns([uri]);
    mockConfigurePrinter
      .expectCallWith({
        uri,
        config,
      })
      .returns(undefined);
    mockGetPrinterRichStatus.expectCallWith().returns(richStatus);
    expect(await printer.status()).toEqual({
      connected: true,
      config,
      richStatus,
    });
  });
});
