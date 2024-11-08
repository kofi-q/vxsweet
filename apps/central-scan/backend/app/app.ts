import { Scan } from '@vx/libs/api/src';
import { type DippedSmartCardAuthApi } from '@vx/libs/auth/dipped-cards';
import { generateSignedHashValidationQrCodeValue } from '@vx/libs/auth/validation';
import { type Result, ok } from '@vx/libs/basics/result';
import { assert } from '@vx/libs/basics/assert';
import { createSystemCallApi } from '@vx/libs/backend/system_call';
import { type DiskSpaceSummary } from '@vx/libs/backend/diagnostics';
import { readSignedElectionPackageFromUsb } from '@vx/libs/backend/election_package';
import {
  exportCastVoteRecordsToUsbDrive,
  type ElectionRecord,
} from '@vx/libs/backend/cast_vote_records';
import {
  type ElectionPackageConfigurationError,
  type BallotPageLayout,
  DEFAULT_SYSTEM_SETTINGS,
  type ElectionDefinition,
  type SystemSettings,
} from '@vx/libs/types/elections';
import { type DiagnosticRecord } from '@vx/libs/types/diagnostics';
import { type ExportCastVoteRecordsToUsbDriveError } from '@vx/libs/types/cvrs';
import { isElectionManagerAuth } from '@vx/libs/utils/src';
import express, { Application } from 'express';
import * as grout from '@vx/libs/grout/src';
import { LogEventId, Logger } from '@vx/libs/logging/src';
import { useDevDockRouter } from '@vx/libs/dev-dock/backend/src';
import { type UsbDrive, type UsbDriveStatus } from '@vx/libs/usb-drive/src';
import { Importer } from '../importer/importer';
import { type Workspace } from '../workspace/workspace';
import { type MachineConfig, type ScanStatus } from '../types/types';
import { getMachineConfig } from '../config/machine_config';
import { constructAuthMachineState } from '../auth/auth';
import {
  logBatchStartFailure,
  logBatchStartSuccess,
  logScanBatchContinueFailure,
  logScanBatchContinueSuccess,
} from '../logging/logging';
import { saveReadinessReport } from '../reports/readiness_report';
import {
  performScanDiagnostic,
  type ScanDiagnosticOutcome,
} from '../diagnostic/diagnostic';
import { type BatchScanner } from '../scanners/fujitsu/fujitsu_scanner';
import path from 'node:path';

type NoParams = never;

export interface AppOptions {
  auth: DippedSmartCardAuthApi;
  allowedExportPatterns?: string[];
  scanner: BatchScanner;
  importer: Importer;
  workspace: Workspace;
  logger: Logger;
  usbDrive: UsbDrive;
}

function buildApiInternal({
  auth,
  workspace,
  logger,
  usbDrive,
  scanner,
  importer,
}: Exclude<AppOptions, 'allowedExportPatterns'>) {
  const { store } = workspace;

  return grout.createApi({
    getAuthStatus() {
      return auth.getAuthStatus(constructAuthMachineState(workspace));
    },

    checkPin(input: { pin: string }) {
      return auth.checkPin(constructAuthMachineState(workspace), input);
    },

    logOut() {
      return auth.logOut(constructAuthMachineState(workspace));
    },

    getUsbDriveStatus(): Promise<UsbDriveStatus> {
      return usbDrive.status();
    },

    ejectUsbDrive(): Promise<void> {
      return usbDrive.eject();
    },

    getMachineConfig(): MachineConfig {
      return getMachineConfig();
    },

    getTestMode() {
      return store.getTestMode();
    },

    async setTestMode(input: { testMode: boolean }) {
      const { testMode } = input;
      void logger.logAsCurrentRole(LogEventId.TogglingTestMode, {
        message: `Toggling to ${testMode ? 'Test' : 'Official'} Ballot Mode...`,
      });
      await importer.setTestMode(testMode);
      void logger.logAsCurrentRole(LogEventId.ToggledTestMode, {
        disposition: 'success',
        message: `Successfully toggled to ${
          testMode ? 'Test' : 'Official'
        } Ballot Mode`,
      });
    },

    updateSessionExpiry(input: { sessionExpiresAt: Date }) {
      return auth.updateSessionExpiry(
        constructAuthMachineState(workspace),
        input
      );
    },

    async deleteBatch({ batchId }: { batchId: string }) {
      const numberOfBallotsInBatch = workspace.store
        .getBatches()
        .find((batch) => batch.id === batchId)?.count;

      void logger.logAsCurrentRole(LogEventId.DeleteScanBatchInit, {
        message: `User deleting batch id ${batchId}...`,
        numberOfBallotsInBatch,
        batchId,
      });

      try {
        workspace.store.deleteBatch(batchId);
        void logger.logAsCurrentRole(LogEventId.DeleteScanBatchComplete, {
          disposition: 'success',
          message: `User successfully deleted batch id: ${batchId} containing ${numberOfBallotsInBatch} ballots.`,
          numberOfBallotsInBatch,
          batchId,
        });
      } catch (error) {
        assert(error instanceof Error);
        await logger.logAsCurrentRole(LogEventId.DeleteScanBatchComplete, {
          disposition: 'failure',
          message: `Error deleting batch id: ${batchId}.`,
          error: error.message,
          result: 'Batch not deleted.',
        });
        throw error;
      }
    },

    async configureFromElectionPackageOnUsbDrive(): Promise<
      Result<ElectionDefinition, ElectionPackageConfigurationError>
    > {
      const authStatus = await auth.getAuthStatus(
        constructAuthMachineState(workspace)
      );

      const electionPackageResult = await readSignedElectionPackageFromUsb(
        authStatus,
        usbDrive,
        logger
      );
      if (electionPackageResult.isErr()) {
        void logger.logAsCurrentRole(LogEventId.ElectionConfigured, {
          message: `Error configuring machine.`,
          disposition: 'failure',
          errorDetails: JSON.stringify(electionPackageResult.err()),
        });
        return electionPackageResult;
      }
      assert(isElectionManagerAuth(authStatus));
      const { electionPackage, electionPackageHash } =
        electionPackageResult.ok();
      const { electionDefinition, systemSettings } = electionPackage;
      assert(systemSettings);

      importer.configure(
        electionDefinition,
        authStatus.user.jurisdiction,
        electionPackageHash
      );
      store.setSystemSettings(systemSettings);

      void logger.logAsCurrentRole(LogEventId.ElectionConfigured, {
        message: `Machine configured for election with hash: ${electionDefinition.ballotHash}`,
        disposition: 'success',
        ballotHash: electionDefinition.ballotHash,
      });

      return ok(electionDefinition);
    },

    getSystemSettings(): SystemSettings {
      return workspace.store.getSystemSettings() ?? DEFAULT_SYSTEM_SETTINGS;
    },

    getElectionRecord(): ElectionRecord | null {
      return store.getElectionRecord() || null;
    },

    getStatus(): ScanStatus {
      return importer.getStatus();
    },

    async scanBatch(): Promise<void> {
      try {
        const batchId = await importer.startImport();
        void logBatchStartSuccess(logger, batchId);
      } catch (error) {
        assert(error instanceof Error);
        void logBatchStartFailure(logger, error);
      }
    },

    continueScanning(input: { forceAccept: boolean }): void {
      try {
        const { forceAccept } = input;
        importer.continueImport(input);
        void logScanBatchContinueSuccess(logger, forceAccept);
      } catch (error) {
        assert(error instanceof Error);
        void logScanBatchContinueFailure(logger, error);
      }
    },

    async unconfigure(
      input: {
        ignoreBackupRequirement?: boolean;
      } = {}
    ): Promise<void> {
      // frontend should only allow this call if the machine can be unconfigured
      assert(store.getCanUnconfigure() || input.ignoreBackupRequirement);

      await importer.unconfigure();
      void logger.logAsCurrentRole(LogEventId.ElectionUnconfigured, {
        disposition: 'success',
        message:
          'User successfully unconfigured the machine to remove the current election and all current ballot data.',
      });
    },

    async clearBallotData(): Promise<void> {
      // frontend should only allow this call if the machine can be unconfigured
      assert(store.getCanUnconfigure());

      await importer.doZero();
    },

    async exportCastVoteRecordsToUsbDrive(input: {
      isMinimalExport?: boolean;
    }): Promise<Result<void, ExportCastVoteRecordsToUsbDriveError>> {
      const logItem = input.isMinimalExport ? 'cast vote records' : 'backup';
      void logger.logAsCurrentRole(LogEventId.ExportCastVoteRecordsInit, {
        message: `Exporting ${logItem}...`,
      });
      const exportResult = await exportCastVoteRecordsToUsbDrive(
        store,
        usbDrive,
        input.isMinimalExport
          ? store.forEachAcceptedSheet()
          : store.forEachSheet(),
        { scannerType: 'central', isMinimalExport: input.isMinimalExport }
      );
      if (!input.isMinimalExport) {
        store.setScannerBackedUp();
      }
      if (exportResult.isErr()) {
        void logger.logAsCurrentRole(LogEventId.ExportCastVoteRecordsComplete, {
          disposition: 'failure',
          message: `Error exporting ${logItem}.`,
          errorDetails: JSON.stringify(exportResult.err()),
        });
      } else {
        void logger.logAsCurrentRole(LogEventId.ExportCastVoteRecordsComplete, {
          disposition: 'success',
          message: `Successfully exported ${logItem}.`,
        });
      }
      return exportResult;
    },

    saveReadinessReport() {
      return saveReadinessReport({
        workspace,
        isScannerAttached: importer.getStatus().isScannerAttached,
        usbDrive,
        logger,
      });
    },

    async performScanDiagnostic(): Promise<ScanDiagnosticOutcome> {
      return await performScanDiagnostic(scanner, store, logger);
    },

    getMostRecentScannerDiagnostic(): DiagnosticRecord | null {
      return store.getMostRecentDiagnosticRecord('blank-sheet-scan') ?? null;
    },

    getApplicationDiskSpaceSummary(): Promise<DiskSpaceSummary> {
      return workspace.getDiskSpaceSummary();
    },

    /* istanbul ignore next */
    async generateSignedHashValidationQrCodeValue() {
      const { codeVersion, machineId } = getMachineConfig();
      const electionRecord = store.getElectionRecord();
      void logger.logAsCurrentRole(LogEventId.SignedHashValidationInit);
      const qrCodeValue = await generateSignedHashValidationQrCodeValue({
        electionRecord,
        machineId,
        softwareVersion: codeVersion,
      });
      void logger.logAsCurrentRole(LogEventId.SignedHashValidationComplete, {
        disposition: 'success',
      });
      return qrCodeValue;
    },

    ...createSystemCallApi({
      usbDrive,
      logger,
      machineId: getMachineConfig().machineId,
      codeVersion: getMachineConfig().codeVersion,
    }),
  });
}

/**
 * A type to be used by the frontend to create a Grout API client
 */
export type Api = ReturnType<typeof buildApiInternal>;

export function buildApi(
  params: Exclude<AppOptions, 'allowedExportPatterns'>
): Api {
  return buildApiInternal(params);
}

/**
 * Builds an express application, using `store` and `importer` to do the heavy
 * lifting.
 */
export function buildCentralScannerApp({
  auth,
  scanner,
  importer,
  workspace,
  logger,
  usbDrive,
}: AppOptions): Application {
  const { store } = workspace;

  const app: Application = express();
  const api = buildApi({
    auth,
    workspace,
    logger,
    usbDrive,
    scanner,
    importer,
  });
  app.use('/api', grout.buildRouter(api, express));
  useDevDockRouter(app, express, 'central-scan');

  const deprecatedApiRouter = express.Router();
  deprecatedApiRouter.use(express.raw());
  deprecatedApiRouter.use(
    express.json({ limit: '5mb', type: 'application/json' })
  );
  deprecatedApiRouter.use(express.urlencoded({ extended: false }));

  deprecatedApiRouter.get(
    '/central-scanner/scan/hmpb/ballot/:sheetId/:side/image',
    (request, response) => {
      const { sheetId, side } = request.params;

      if (
        typeof sheetId !== 'string' ||
        (side !== 'front' && side !== 'back')
      ) {
        response.status(404);
        return;
      }
      const imagePath = store.getBallotImagePath(sheetId, side);

      if (imagePath) {
        response.sendFile(imagePath);
      } else {
        response.status(404).end();
      }
    }
  );

  deprecatedApiRouter.get<NoParams, Scan.GetNextReviewSheetResponse>(
    '/central-scanner/scan/hmpb/review/next-sheet',
    (_request, response) => {
      const sheet = store.getNextAdjudicationSheet();

      if (sheet) {
        let frontLayout: BallotPageLayout | undefined;
        let backLayout: BallotPageLayout | undefined;
        let frontDefinition:
          | Scan.GetNextReviewSheetResponse['definitions']['front']
          | undefined;
        let backDefinition:
          | Scan.GetNextReviewSheetResponse['definitions']['back']
          | undefined;

        if (sheet.front.interpretation.type === 'InterpretedHmpbPage') {
          const front = sheet.front.interpretation;
          frontLayout = front.layout;
          const contestIds = Object.keys(front.votes);
          frontDefinition = { contestIds };
        }

        if (sheet.back.interpretation.type === 'InterpretedHmpbPage') {
          const back = sheet.back.interpretation;
          const contestIds = Object.keys(back.votes);

          backLayout = back.layout;
          backDefinition = { contestIds };
        }

        response.json({
          interpreted: sheet,
          layouts: {
            front: frontLayout,
            back: backLayout,
          },
          definitions: {
            front: frontDefinition,
            back: backDefinition,
          },
        });
      } else {
        response.status(404).end();
      }
    }
  );

  app.use(deprecatedApiRouter);

  // `STATIC_FILE_DIR` is set when running the in `production` mode - when its
  // specified, set up static file serving routes for frontend files:
  const { STATIC_FILE_DIR } = process.env;
  if (STATIC_FILE_DIR) {
    const STATIC_FILE_DIR_ABS = path.join(process.cwd(), STATIC_FILE_DIR);

    app.use(express.static(STATIC_FILE_DIR_ABS));
    app.get('*', (_, res) => {
      res.sendFile(path.join(STATIC_FILE_DIR_ABS, 'index.html'));
    });
  }

  return app;
}
