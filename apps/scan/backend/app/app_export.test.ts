jest.mock('@vx/libs/utils/src', (): typeof import('@vx/libs/utils/src') => {
  return {
    ...jest.requireActual('@vx/libs/utils/src'),
    isFeatureFlagEnabled: (flag) => mockFeatureFlagger.isEnabled(flag),
  };
});

import {
  getCastVoteRecordExportDirectoryPaths,
  readCastVoteRecordExport,
} from '@vx/libs/backend/cast_vote_records';
import { assertDefined } from '@vx/libs/basics/assert';
import { err, ok } from '@vx/libs/basics/result';
import { mockOf } from '@vx/libs/test-utils/src';
import { CVR } from '@vx/libs/types/cdf';
import {
  BooleanEnvironmentVariableName,
  convertCastVoteRecordVotesToTabulationVotes,
  getCurrentSnapshot,
  getFeatureFlagMock,
} from '@vx/libs/utils/src';

import { scanBallot, withApp } from '../test/helpers/pdi_helpers';
import { configureApp } from '../test/helpers/shared_helpers';

jest.setTimeout(30_000);

const mockFeatureFlagger = getFeatureFlagMock();

beforeEach(() => {
  mockFeatureFlagger.resetFeatureFlags();
  mockFeatureFlagger.enableFeatureFlag(
    BooleanEnvironmentVariableName.SKIP_ELECTION_PACKAGE_AUTHENTICATION
  );
});

test('continuous CVR export, including polls closing', async () => {
  await withApp(
    async ({ api, mockAuth, mockScanner, mockUsbDrive, workspace, clock }) => {
      await configureApp(api, mockAuth, mockUsbDrive, {
        testMode: true,
        openPolls: true,
      });

      // Don't wait for continuous export to USB drive in between scans and polls closing so that
      // we can verify that the continuous export mutex prevents continuous export operations from
      // interleaving
      await scanBallot(mockScanner, clock, api, workspace.store, 0, {
        waitForContinuousExportToUsbDrive: false,
      });
      await scanBallot(mockScanner, clock, api, workspace.store, 1, {
        waitForContinuousExportToUsbDrive: false,
      });
      await scanBallot(mockScanner, clock, api, workspace.store, 2, {
        waitForContinuousExportToUsbDrive: false,
      });

      await api.closePolls();

      const exportDirectoryPaths = await getCastVoteRecordExportDirectoryPaths(
        mockUsbDrive.usbDrive
      );
      expect(exportDirectoryPaths).toHaveLength(1);
      expect(exportDirectoryPaths[0]).toMatch(/\/TEST__machine_000__*/);

      const { castVoteRecordExportMetadata, castVoteRecordIterator } = (
        await readCastVoteRecordExport(exportDirectoryPaths[0])
      ).unsafeUnwrap();

      expect(castVoteRecordExportMetadata.arePollsClosed).toEqual(true);
      expect(castVoteRecordExportMetadata.batchManifest[0].sheetCount).toEqual(
        3
      );

      const castVoteRecords: CVR.CVR[] = (
        await castVoteRecordIterator.toArray()
      ).map(
        (castVoteRecordResult) =>
          castVoteRecordResult.unsafeUnwrap().castVoteRecord
      );
      expect(castVoteRecords).toHaveLength(3);

      for (const castVoteRecord of castVoteRecords) {
        const tabulationVotes = convertCastVoteRecordVotesToTabulationVotes(
          assertDefined(getCurrentSnapshot(castVoteRecord))
        );
        expect(tabulationVotes).toEqual({
          attorney: ['john-snow'],
          'board-of-alderman': [
            'helen-keller',
            'steve-jobs',
            'nikola-tesla',
            'vincent-van-gogh',
          ],
          'chief-of-police': ['natalie-portman'],
          'city-council': [
            'marie-curie',
            'indiana-jones',
            'mona-lisa',
            'jackie-chan',
          ],
          controller: ['winston-churchill'],
          mayor: ['sherlock-holmes'],
          'parks-and-recreation-director': ['charles-darwin'],
          'public-works-director': ['benjamin-franklin'],
        });
      }
    }
  );
});

test('continuous CVR export, including polls closing, followed by a full export', async () => {
  await withApp(
    async ({ api, mockAuth, mockScanner, mockUsbDrive, workspace, clock }) => {
      await configureApp(api, mockAuth, mockUsbDrive, {
        testMode: true,
        openPolls: true,
      });

      // Don't wait for continuous export to USB drive in between scans and polls closing so that
      // we can verify that the continuous export mutex prevents continuous export operations from
      // interleaving
      await scanBallot(mockScanner, clock, api, workspace.store, 0, {
        waitForContinuousExportToUsbDrive: false,
      });
      await scanBallot(mockScanner, clock, api, workspace.store, 1, {
        waitForContinuousExportToUsbDrive: false,
      });

      await api.closePolls();

      expect(
        await api.exportCastVoteRecordsToUsbDrive({ mode: 'full_export' })
      ).toEqual(ok());

      // Expect two export directories, one from continuous export finished at polls closed
      // and one from the subsequent full export. Each should contain two CVRs.
      const exportDirectoryPaths = await getCastVoteRecordExportDirectoryPaths(
        mockUsbDrive.usbDrive
      );
      expect(exportDirectoryPaths).toHaveLength(2);

      for (const exportDirectoryPath of exportDirectoryPaths) {
        const { castVoteRecordIterator } = (
          await readCastVoteRecordExport(exportDirectoryPath)
        ).unsafeUnwrap();
        const castVoteRecords: CVR.CVR[] = (
          await castVoteRecordIterator.toArray()
        ).map(
          (castVoteRecordResult) =>
            castVoteRecordResult.unsafeUnwrap().castVoteRecord
        );
        expect(castVoteRecords).toHaveLength(2);
      }
    }
  );
});

test('continuous CVR export with a mode switch in between', async () => {
  await withApp(
    async ({ api, mockAuth, mockScanner, mockUsbDrive, workspace, clock }) => {
      await configureApp(api, mockAuth, mockUsbDrive, { testMode: true });

      // Don't wait for continuous export to USB drive in between scans and polls closing so that
      // we can verify that the continuous export mutex prevents continuous export operations from
      // interleaving
      await scanBallot(mockScanner, clock, api, workspace.store, 0, {
        waitForContinuousExportToUsbDrive: false,
      });
      await scanBallot(mockScanner, clock, api, workspace.store, 1, {
        waitForContinuousExportToUsbDrive: false,
      });

      await api.setTestMode({ isTestMode: false });
      await api.setTestMode({ isTestMode: true });
      (await api.openPolls()).unsafeUnwrap();

      await scanBallot(mockScanner, clock, api, workspace.store, 0);

      // Expect two export directories, one from before the mode switch and one from after
      const exportDirectoryPaths = await getCastVoteRecordExportDirectoryPaths(
        mockUsbDrive.usbDrive
      );
      expect(exportDirectoryPaths).toHaveLength(2);

      for (const [i, exportDirectoryPath] of exportDirectoryPaths.entries()) {
        const { castVoteRecordIterator } = (
          await readCastVoteRecordExport(exportDirectoryPath)
        ).unsafeUnwrap();
        const castVoteRecords: CVR.CVR[] = (
          await castVoteRecordIterator.toArray()
        ).map(
          (castVoteRecordResult) =>
            castVoteRecordResult.unsafeUnwrap().castVoteRecord
        );
        if (i === 0) {
          // Directory before mode switch
          expect(castVoteRecords).toHaveLength(2);
        } else {
          // Directory before mode switch
          expect(castVoteRecords).toHaveLength(1);
        }
      }
    }
  );
});

test('CVR resync', async () => {
  await withApp(
    async ({ api, mockAuth, mockScanner, mockUsbDrive, workspace, clock }) => {
      await configureApp(api, mockAuth, mockUsbDrive, { testMode: true });

      await scanBallot(mockScanner, clock, api, workspace.store, 0);

      // When a CVR resync is required, the CVR resync modal appears on the "insert your ballot"
      // screen, i.e. the screen displayed when no card is inserted
      mockOf(mockAuth.getAuthStatus).mockImplementation(() =>
        Promise.resolve({ status: 'logged_out', reason: 'no_card' })
      );

      expect(
        await api.exportCastVoteRecordsToUsbDrive({
          mode: 'recovery_export',
        })
      ).toEqual(ok());
    }
  );
});

test('CVR resync after swapping the USB drive', async () => {
  await withApp(
    async ({ api, clock, mockAuth, mockScanner, mockUsbDrive, workspace }) => {
      await configureApp(api, mockAuth, mockUsbDrive, { testMode: true });

      await scanBallot(mockScanner, clock, api, workspace.store, 0);

      mockUsbDrive.removeUsbDrive();
      mockUsbDrive.insertUsbDrive({});

      expect(
        await api.exportCastVoteRecordsToUsbDrive({
          mode: 'recovery_export',
        })
      ).toEqual(ok());
    }
  );
});

test('pausing and resuming continuous CVR export', async () => {
  await withApp(
    async ({ api, clock, mockAuth, mockScanner, mockUsbDrive, workspace }) => {
      await configureApp(api, mockAuth, mockUsbDrive, { testMode: true });

      await scanBallot(mockScanner, clock, api, workspace.store, 0);

      api.setIsContinuousExportEnabled({ isContinuousExportEnabled: false });

      await scanBallot(mockScanner, clock, api, workspace.store, 1, {
        waitForContinuousExportToUsbDrive: false,
      });

      let usbDriveStatus = await api.getUsbDriveStatus();
      expect(
        usbDriveStatus.doesUsbDriveRequireCastVoteRecordSync
      ).toBeUndefined();

      api.setIsContinuousExportEnabled({
        isContinuousExportEnabled: true,
      });

      usbDriveStatus = await api.getUsbDriveStatus();
      expect(usbDriveStatus.doesUsbDriveRequireCastVoteRecordSync).toEqual(
        true
      );

      expect(
        await api.exportCastVoteRecordsToUsbDrive({
          mode: 'recovery_export',
        })
      ).toEqual(ok());

      usbDriveStatus = await api.getUsbDriveStatus();
      expect(
        usbDriveStatus.doesUsbDriveRequireCastVoteRecordSync
      ).toBeUndefined();

      const exportDirectoryPaths = await getCastVoteRecordExportDirectoryPaths(
        mockUsbDrive.usbDrive
      );
      expect(exportDirectoryPaths).toHaveLength(1);
      const exportDirectoryPath = exportDirectoryPaths[0];

      const { castVoteRecordIterator } = (
        await readCastVoteRecordExport(exportDirectoryPath)
      ).unsafeUnwrap();
      const castVoteRecords: CVR.CVR[] = (
        await castVoteRecordIterator.toArray()
      ).map(
        (castVoteRecordResult) =>
          castVoteRecordResult.unsafeUnwrap().castVoteRecord
      );
      expect(castVoteRecords).toHaveLength(2);
    }
  );
});

test('CVR export error handling', async () => {
  await withApp(
    async ({ api, clock, mockAuth, mockScanner, mockUsbDrive, workspace }) => {
      await configureApp(api, mockAuth, mockUsbDrive, { testMode: true });

      await scanBallot(mockScanner, clock, api, workspace.store, 0);

      mockUsbDrive.removeUsbDrive();

      expect(
        await api.exportCastVoteRecordsToUsbDrive({
          mode: 'full_export',
        })
      ).toEqual(err({ type: 'missing-usb-drive' }));
    }
  );
});
