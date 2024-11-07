import * as grout from '@vx/libs/grout/src';
import { useDevDockRouter } from '@vx/libs/dev-dock/backend/src';
import { LogEventId, Logger } from '@vx/libs/logging/src';
import {
  type ElectionPackageConfigurationError,
  type PrecinctSelection,
  type SinglePrecinctSelection,
  DEFAULT_SYSTEM_SETTINGS,
} from '@vx/libs/types/elections';
import {
  type DiagnosticRecord,
  type DiagnosticOutcome,
} from '@vx/libs/types/diagnostics';
import {
  getPrecinctSelectionName,
  isElectionManagerAuth,
  singlePrecinctSelectionFor,
} from '@vx/libs/utils/src';
import express, { Application } from 'express';
import {
  createUiStringsApi,
  configureUiStrings,
} from '@vx/libs/backend/src/ui_strings';
import { createSystemCallApi } from '@vx/libs/backend/src/system_call';
import { readSignedElectionPackageFromUsb } from '@vx/libs/backend/src/election_package';
import { doesUsbDriveRequireCastVoteRecordSync as doesUsbDriveRequireCastVoteRecordSyncFn } from '@vx/libs/backend/src/cast_vote_records';
import { type DiskSpaceSummary } from '@vx/libs/backend/src';
import { assert, assertDefined } from '@vx/libs/basics/assert';
import { ok, type Result } from '@vx/libs/basics/result';
import {
  type InsertedSmartCardAuthApi,
  generateSignedHashValidationQrCodeValue,
} from '@vx/libs/auth/src';
import { type UsbDrive, type UsbDriveStatus } from '@vx/libs/usb-drive/src';
import {
  type FujitsuPrintResult,
  type Printer,
  type PrinterStatus,
  type PrintResult,
} from '../printing/printer';
import {
  type PrecinctScannerStateMachine,
  type PrecinctScannerConfig,
  type PrecinctScannerStatus,
  type PrecinctScannerPollsInfo,
} from '../types/types';
import { constructAuthMachineState } from '../auth/auth';
import { type Workspace } from '../workspace/workspace';
import { getMachineConfig } from '../config/machine_config';
import {
  exportCastVoteRecordsToUsbDrive,
  type ExportCastVoteRecordsToUsbDriveResult,
} from '../export/export';
import {
  openPolls,
  type OpenPollsResult,
  closePolls,
  pauseVoting,
  resumeVoting,
  resetPollsToPaused,
} from '../polls/polls';
import { printTestPage } from '../printing/test_print';
import { printFullReport } from '../printing/print_full_report';
import { printReportSection } from '../printing/print_report_section';
import {
  TEST_AUDIO_USER_FAIL_REASON,
  TEST_PRINT_USER_FAIL_REASON,
  testPrintFailureDiagnosticMessage,
} from '../diagnostics/diagnostics';
import { saveReadinessReport } from '../printing/readiness_report';
import path from 'node:path';

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function buildApi({
  auth,
  machine,
  workspace,
  usbDrive,
  printer,
  logger,
}: {
  auth: InsertedSmartCardAuthApi;
  machine: PrecinctScannerStateMachine;
  workspace: Workspace;
  usbDrive: UsbDrive;
  printer: Printer;
  logger: Logger;
}) {
  const { store } = workspace;

  return grout.createApi({
    getMachineConfig,

    getAuthStatus() {
      return auth.getAuthStatus(constructAuthMachineState(workspace.store));
    },

    checkPin(input: { pin: string }) {
      return auth.checkPin(constructAuthMachineState(workspace.store), input);
    },

    logOut() {
      return auth.logOut(constructAuthMachineState(workspace.store));
    },

    updateSessionExpiry(input: { sessionExpiresAt: Date }) {
      return auth.updateSessionExpiry(
        constructAuthMachineState(workspace.store),
        input
      );
    },

    async generateSignedHashValidationQrCodeValue() {
      const { codeVersion, machineId } = getMachineConfig();
      const electionRecord = store.getElectionRecord();
      await logger.logAsCurrentRole(LogEventId.SignedHashValidationInit);
      const qrCodeValue = await generateSignedHashValidationQrCodeValue({
        electionRecord,
        machineId,
        softwareVersion: codeVersion,
      });
      await logger.logAsCurrentRole(LogEventId.SignedHashValidationComplete, {
        disposition: 'success',
      });
      return qrCodeValue;
    },

    async getUsbDriveStatus(): Promise<
      UsbDriveStatus & { doesUsbDriveRequireCastVoteRecordSync?: true }
    > {
      const usbDriveStatus = await usbDrive.status();
      return {
        ...usbDriveStatus,
        doesUsbDriveRequireCastVoteRecordSync:
          (await doesUsbDriveRequireCastVoteRecordSyncFn(
            store,
            usbDriveStatus
          )) || undefined,
      };
    },

    ejectUsbDrive(): Promise<void> {
      return usbDrive.eject();
    },

    async configureFromElectionPackageOnUsbDrive(): Promise<
      Result<void, ElectionPackageConfigurationError>
    > {
      assert(!store.getElectionRecord(), 'Already configured');

      const authStatus = await auth.getAuthStatus(
        constructAuthMachineState(workspace.store)
      );
      const electionPackageResult = await readSignedElectionPackageFromUsb(
        authStatus,
        usbDrive,
        logger
      );
      if (electionPackageResult.isErr()) {
        await logger.logAsCurrentRole(LogEventId.ElectionConfigured, {
          disposition: 'failure',
          message: 'Error configuring machine.',
          errorDetails: JSON.stringify(electionPackageResult.err()),
        });
        return electionPackageResult;
      }
      assert(isElectionManagerAuth(authStatus));
      const { electionPackage, electionPackageHash } =
        electionPackageResult.ok();
      const { electionDefinition, systemSettings } = electionPackage;
      assert(systemSettings);
      let precinctSelection: SinglePrecinctSelection | undefined;
      if (electionDefinition.election.precincts.length === 1) {
        precinctSelection = singlePrecinctSelectionFor(
          electionDefinition.election.precincts[0].id
        );
      }

      store.withTransaction(() => {
        store.setElectionAndJurisdiction({
          electionData: electionDefinition.electionData,
          jurisdiction: authStatus.user.jurisdiction,
          electionPackageHash,
        });
        if (precinctSelection) {
          store.setPrecinctSelection(precinctSelection);
        }
        store.setSystemSettings(systemSettings);

        configureUiStrings({
          electionPackage,
          logger,
          noAudio: true,
          store: workspace.store.getUiStringsStore(),
        });
      });

      await logger.logAsCurrentRole(LogEventId.ElectionConfigured, {
        message: `Machine configured for election with hash: ${electionDefinition.ballotHash}`,
        disposition: 'success',
        ballotHash: electionDefinition.ballotHash,
      });
      return ok();
    },

    getConfig(): PrecinctScannerConfig {
      const electionRecord = store.getElectionRecord();
      return {
        electionDefinition: electionRecord?.electionDefinition,
        electionPackageHash: electionRecord?.electionPackageHash,
        systemSettings: store.getSystemSettings() ?? DEFAULT_SYSTEM_SETTINGS,
        precinctSelection: store.getPrecinctSelection(),
        isSoundMuted: store.getIsSoundMuted(),
        isTestMode: store.getTestMode(),
        isDoubleFeedDetectionDisabled: store.getIsDoubleFeedDetectionDisabled(),
        isContinuousExportEnabled: store.getIsContinuousExportEnabled(),
      };
    },

    getPollsInfo(): PrecinctScannerPollsInfo {
      const pollsState = store.getPollsState();
      if (pollsState === 'polls_closed_initial') {
        return {
          pollsState,
        };
      }

      return {
        pollsState,
        lastPollsTransition: assertDefined(store.getLastPollsTransition()),
      };
    },

    async unconfigureElection(): Promise<void> {
      workspace.reset();
      await logger.logAsCurrentRole(LogEventId.ElectionUnconfigured, {
        disposition: 'success',
        message:
          'User successfully unconfigured the machine to remove the current election and all current ballot data.',
      });
    },

    async setPrecinctSelection(input: {
      precinctSelection: PrecinctSelection;
    }): Promise<void> {
      const { electionDefinition } = assertDefined(store.getElectionRecord());
      assert(
        store.getBallotsCounted() === 0,
        'Attempt to change precinct selection after ballots have been cast'
      );
      store.setPrecinctSelection(input.precinctSelection);
      workspace.resetElectionSession();
      await logger.logAsCurrentRole(LogEventId.PrecinctConfigurationChanged, {
        disposition: 'success',
        message: `User set the precinct for the machine to ${getPrecinctSelectionName(
          electionDefinition.election.precincts,
          input.precinctSelection
        )}`,
      });
    },

    async setIsSoundMuted(input: { isSoundMuted: boolean }): Promise<void> {
      store.setIsSoundMuted(input.isSoundMuted);
      await logger.logAsCurrentRole(LogEventId.SoundToggled, {
        message: `Sounds were toggled ${input.isSoundMuted ? 'off' : 'on'}`,
        disposition: 'success',
        isSoundMuted: input.isSoundMuted,
      });
    },

    async setIsDoubleFeedDetectionDisabled(input: {
      isDoubleFeedDetectionDisabled: boolean;
    }): Promise<void> {
      store.setIsDoubleFeedDetectionDisabled(
        input.isDoubleFeedDetectionDisabled
      );
      await logger.logAsCurrentRole(LogEventId.DoubleSheetDetectionToggled, {
        message: `Double sheet detection was toggled ${
          input.isDoubleFeedDetectionDisabled ? 'off' : 'on'
        }`,
        disposition: 'success',
        isDoubleFeedDetectionDisabled: input.isDoubleFeedDetectionDisabled,
      });
    },

    async setIsContinuousExportEnabled(input: {
      isContinuousExportEnabled: boolean;
    }): Promise<void> {
      store.setIsContinuousExportEnabled(input.isContinuousExportEnabled);
      await logger.logAsCurrentRole(LogEventId.ContinuousExportToggled, {
        message: `Continuous export was ${
          input.isContinuousExportEnabled ? 'resumed' : 'paused'
        }`,
        disposition: 'success',
      });
    },

    async setTestMode(input: { isTestMode: boolean }): Promise<void> {
      const logMessage = input.isTestMode
        ? 'official to test'
        : 'test to official';
      await logger.logAsCurrentRole(LogEventId.TogglingTestMode, {
        message: `Toggling from ${logMessage} mode`,
        isTestMode: input.isTestMode,
      });
      // Use the continuous export mutex to ensure that any pending continuous export operations
      // finish first
      await workspace.continuousExportMutex.withLock(() =>
        workspace.resetElectionSession()
      );
      store.setTestMode(input.isTestMode);
      await logger.logAsCurrentRole(LogEventId.ToggledTestMode, {
        disposition: 'success',
        message: `Successfully toggled from ${logMessage} mode.`,
        isTestMode: input.isTestMode,
      });
    },

    openPolls(): Promise<OpenPollsResult> {
      return openPolls({ store, logger });
    },

    closePolls(): Promise<void> {
      return closePolls({ workspace, usbDrive, logger });
    },

    pauseVoting(): Promise<void> {
      return pauseVoting({ store, logger });
    },

    resumeVoting(): Promise<void> {
      return resumeVoting({ store, logger });
    },

    resetPollsToPaused(): Promise<void> {
      return resetPollsToPaused({ store, logger });
    },

    exportCastVoteRecordsToUsbDrive(input: {
      mode: 'full_export' | 'recovery_export';
    }): Promise<ExportCastVoteRecordsToUsbDriveResult> {
      return exportCastVoteRecordsToUsbDrive({
        mode: input.mode,
        workspace,
        usbDrive,
        logger,
      });
    },

    getPrinterStatus(): Promise<PrinterStatus> {
      return printer.getStatus();
    },

    /**
     * If the printer is a V3 hardware printer (standard CUPS printer) then
     * this will print the entire report. If the printer is a V4 hardware
     * printer (embedded Fujitsu thermal roll printer) then this will print the
     * first section of the report only.
     */
    async printReport(): Promise<PrintResult> {
      if (printer.scheme === 'hardware-v3') {
        return {
          scheme: 'hardware-v3',
          pageCount: await printFullReport({ store, printer }),
        };
      }

      return {
        scheme: 'hardware-v4',
        result: await printReportSection({ store, printer, index: 0 }),
      };
    },

    /**
     * Prints a specific section of the report, e.g. for a particular party.
     * This is only used for V4 hardware printers (roll printer).
     */
    printReportSection(input: { index: number }): Promise<FujitsuPrintResult> {
      return printReportSection({
        store,
        printer,
        index: input.index,
      });
    },

    getScannerStatus(): PrecinctScannerStatus {
      const machineStatus = machine.status();
      const ballotsCounted = store.getBallotsCounted();
      return {
        ...machineStatus,
        ballotsCounted,
      };
    },

    acceptBallot(): void {
      machine.accept();
    },

    returnBallot(): void {
      machine.return();
    },

    beginDoubleFeedCalibration(): void {
      machine.beginDoubleFeedCalibration();
    },

    endDoubleFeedCalibration(): void {
      machine.endDoubleFeedCalibration();
    },

    beginScannerDiagnostic(): void {
      void logger.logAsCurrentRole(LogEventId.DiagnosticInit, {
        message: `User initiated a scanner diagnostic.`,
        disposition: 'success',
      });
      return machine.beginScannerDiagnostic();
    },

    endScannerDiagnostic(): void {
      const diagnosticRecord = assertDefined(
        store.getMostRecentDiagnosticRecord('blank-sheet-scan')
      );
      void logger.logAsCurrentRole(LogEventId.DiagnosticComplete, {
        disposition:
          diagnosticRecord?.outcome === 'pass' ? 'success' : 'failure',
        message: 'Scanner diagnostic completed.',
      });
      return machine.endScannerDiagnostic();
    },

    getMostRecentScannerDiagnostic(): DiagnosticRecord | null {
      return store.getMostRecentDiagnosticRecord('blank-sheet-scan') ?? null;
    },

    async printTestPage(): Promise<FujitsuPrintResult> {
      void logger.logAsCurrentRole(LogEventId.DiagnosticInit, {
        message: `User initiated a test page print.`,
        disposition: 'success',
      });
      const printResult = await printTestPage({ printer });

      // If the print failed before it completed, we log that proactively
      // rather than expecting the frontend to make a separate request.
      if (printResult.isErr()) {
        const diagnosticMessage = testPrintFailureDiagnosticMessage(
          printResult.err()
        );
        store.addDiagnosticRecord({
          type: 'test-print',
          outcome: 'fail',
          message: testPrintFailureDiagnosticMessage(printResult.err()),
        });
        void logger.logAsCurrentRole(LogEventId.DiagnosticComplete, {
          disposition: 'failure',
          message: `Test print failed. ${diagnosticMessage}`,
        });
      }

      return printResult;
    },

    logTestPrintOutcome(input: { outcome: 'pass' | 'fail' }): void {
      store.addDiagnosticRecord({
        type: 'test-print',
        outcome: input.outcome,
        message:
          input.outcome === 'pass' ? undefined : TEST_PRINT_USER_FAIL_REASON,
      });
      void logger.logAsCurrentRole(LogEventId.DiagnosticComplete, {
        disposition: input.outcome === 'pass' ? 'success' : 'failure',
        message:
          input.outcome === 'pass'
            ? 'Test print successful.'
            : `Test print failed. ${TEST_PRINT_USER_FAIL_REASON}`,
      });
    },

    getMostRecentPrinterDiagnostic(): DiagnosticRecord | null {
      return store.getMostRecentDiagnosticRecord('test-print') ?? null;
    },

    getDiskSpaceSummary(): Promise<DiskSpaceSummary> {
      return workspace.getDiskSpaceSummary();
    },

    saveReadinessReport() {
      return saveReadinessReport({
        workspace,
        usbDrive,
        logger,
        printer,
        machine,
      });
    },

    getMostRecentAudioDiagnostic(): DiagnosticRecord | null {
      return store.getMostRecentDiagnosticRecord('scan-audio') ?? null;
    },

    logAudioDiagnosticOutcome(input: { outcome: DiagnosticOutcome }): void {
      store.addDiagnosticRecord({
        type: 'scan-audio',
        outcome: input.outcome,
        message:
          input.outcome === 'pass' ? undefined : TEST_AUDIO_USER_FAIL_REASON,
      });
      void logger.logAsCurrentRole(LogEventId.DiagnosticComplete, {
        disposition: input.outcome === 'pass' ? 'success' : 'failure',
        message:
          input.outcome === 'pass'
            ? 'Audio playback successful.'
            : `Audio playback failed. ${TEST_AUDIO_USER_FAIL_REASON}`,
      });
    },

    ...createUiStringsApi({
      logger,
      store: workspace.store.getUiStringsStore(),
    }),

    ...createSystemCallApi({
      usbDrive,
      logger,
      machineId: getMachineConfig().machineId,
      codeVersion: getMachineConfig().codeVersion,
    }),
  });
}

export type Api = ReturnType<typeof buildApi>;

export function buildApp({
  auth,
  machine,
  workspace,
  usbDrive,
  printer,
  logger,
}: {
  auth: InsertedSmartCardAuthApi;
  machine: PrecinctScannerStateMachine;
  workspace: Workspace;
  printer: Printer;
  usbDrive: UsbDrive;
  logger: Logger;
}): Application {
  const app: Application = express();
  const api = buildApi({ auth, machine, workspace, usbDrive, printer, logger });
  app.use('/api', grout.buildRouter(api, express));
  useDevDockRouter(app, express, 'scan');

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
