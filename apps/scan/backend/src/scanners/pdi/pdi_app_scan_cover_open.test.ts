jest.mock('@vx/libs/utils/src', (): typeof import('@vx/libs/utils/src') => {
  return {
    ...jest.requireActual('@vx/libs/utils/src'),
    isFeatureFlagEnabled: (flag) => mockFeatureFlagger.isEnabled(flag),
  };
});

import {
  getFeatureFlagMock,
  BooleanEnvironmentVariableName,
} from '@vx/libs/utils/src';
import { Result, deferred, ok } from '@vx/libs/basics/src';
import { ScannerError } from '@vx/libs/pdi-scanner/src/ts';
import {
  configureApp,
  waitForStatus,
} from '../../../test/helpers/shared_helpers';
import { delays } from './state_machine';
import { mockStatus, withApp } from '../../../test/helpers/pdi_helpers';

jest.setTimeout(20_000);

const mockFeatureFlagger = getFeatureFlagMock();

beforeEach(() => {
  mockFeatureFlagger.enableFeatureFlag(
    BooleanEnvironmentVariableName.SKIP_ELECTION_PACKAGE_AUTHENTICATION
  );
});

test('cover open while waiting for ballots', async () => {
  await withApp(
    async ({ apiClient, mockScanner, mockUsbDrive, mockAuth, clock }) => {
      await configureApp(apiClient, mockAuth, mockUsbDrive);

      clock.increment(delays.DELAY_SCANNING_ENABLED_POLLING_INTERVAL);
      await waitForStatus(apiClient, { state: 'no_paper' });

      mockScanner.client.disableScanning.mockClear();
      mockScanner.client.enableScanning.mockClear();
      mockScanner.setScannerStatus(mockStatus.coverOpen);
      mockScanner.emitEvent({ event: 'coverOpen' });
      await waitForStatus(apiClient, { state: 'cover_open' });
      expect(mockScanner.client.disableScanning).toHaveBeenCalled();

      mockScanner.setScannerStatus(mockStatus.idleScanningDisabled);
      mockScanner.emitEvent({ event: 'coverClosed' });
      clock.increment(delays.DELAY_SCANNER_STATUS_POLLING_INTERVAL);
      await waitForStatus(apiClient, { state: 'no_paper' });
      expect(mockScanner.client.enableScanning).toHaveBeenCalled();
    }
  );
});

test('cover open while jammed', async () => {
  await withApp(
    async ({ apiClient, mockScanner, mockUsbDrive, mockAuth, clock }) => {
      await configureApp(apiClient, mockAuth, mockUsbDrive);

      clock.increment(delays.DELAY_SCANNING_ENABLED_POLLING_INTERVAL);
      await waitForStatus(apiClient, { state: 'no_paper' });

      mockScanner.emitEvent({ event: 'scanStart' });
      await waitForStatus(apiClient, { state: 'scanning' });

      mockScanner.setScannerStatus(mockStatus.jammed);
      const deferredEject = deferred<Result<void, ScannerError>>();
      mockScanner.client.ejectDocument.mockReturnValueOnce(
        deferredEject.promise
      );
      mockScanner.emitEvent({ event: 'error', code: 'scanFailed' });
      await waitForStatus(apiClient, {
        state: 'rejecting',
        error: 'scanning_failed',
      });
      deferredEject.resolve(ok());
      await waitForStatus(apiClient, {
        state: 'jammed',
        error: 'scanning_failed',
      });

      mockScanner.setScannerStatus(mockStatus.jammedCoverOpen);
      mockScanner.emitEvent({ event: 'coverOpen' });
      await waitForStatus(apiClient, { state: 'cover_open' });

      mockScanner.setScannerStatus(mockStatus.coverOpen);
      clock.increment(delays.DELAY_SCANNER_STATUS_POLLING_INTERVAL);
      await waitForStatus(apiClient, { state: 'cover_open' });

      mockScanner.setScannerStatus(mockStatus.idleScanningDisabled);
      mockScanner.emitEvent({ event: 'coverClosed' });
      clock.increment(delays.DELAY_SCANNER_STATUS_POLLING_INTERVAL);
      await waitForStatus(apiClient, { state: 'no_paper' });
    }
  );
});
