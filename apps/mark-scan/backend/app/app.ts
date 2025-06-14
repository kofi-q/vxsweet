import express, { Application } from 'express';
import { type InsertedSmartCardAuthApi } from '@vx/libs/auth/inserted-cards';
import { generateSignedHashValidationQrCodeValue } from '@vx/libs/auth/validation';
import {
  assert,
  assertDefined,
  throwIllegalValue,
} from '@vx/libs/basics/assert';
import { ok, type Result } from '@vx/libs/basics/result';
import * as grout from '@vx/libs/grout/src';
import {
  type ElectionPackageConfigurationError,
  type PollsState,
  type PrecinctSelection,
  type BallotStyleId,
  type ElectionDefinition,
  type PrecinctId,
  type SystemSettings,
  DEFAULT_SYSTEM_SETTINGS,
} from '@vx/libs/types/elections';
import {
  type DiagnosticRecord,
  type DiagnosticType,
} from '@vx/libs/types/diagnostics';
import { type PageInterpretation } from '@vx/libs/types/scanning';
import {
  getPrecinctSelectionName,
  isElectionManagerAuth,
  isPollWorkerAuth,
  singlePrecinctSelectionFor,
} from '@vx/libs/utils/src';

import {
  createUiStringsApi,
  configureUiStrings,
} from '@vx/libs/backend/ui_strings';
import { readSignedElectionPackageFromUsb } from '@vx/libs/backend/election_package';
import { createSystemCallApi } from '@vx/libs/backend/system_call';
import { type DiskSpaceSummary } from '@vx/libs/backend/diagnostics';
import { type ExportDataResult } from '@vx/libs/backend/exporter';
import { LogEventId, Logger } from '@vx/libs/logging/src';
import { useDevDockRouter } from '@vx/libs/dev-dock/backend/src';
import { type UsbDrive, type UsbDriveStatus } from '@vx/libs/usb-drive/src';
import {
  type MockPaperHandlerStatus,
  type PaperHandlerDriverInterface,
} from '@vx/libs/custom-paper-handler/src/driver';
import { getMachineConfig } from '../config/machine_config';
import { type Workspace } from '../util/workspace';
import {
  type PaperHandlerStateMachine,
  type AcceptedPaperType,
} from '../custom-paper-handler/state_machine';
import { type SimpleServerStatus } from '../custom-paper-handler/types';
import { buildMockPaperHandlerApi } from '../custom-paper-handler/mock_paper_handler_api';
import {
  type BmdModelNumber,
  type ElectionState,
  type PrintBallotProps,
} from '../types/types';
import {
  getMarkScanBmdModel,
  isAccessibleControllerDaemonRunning,
} from '../util/hardware';
import { saveReadinessReport } from '../reports/readiness_report';
import { renderBallot } from '../util/render_ballot';
import { type ElectionRecord, Store } from '../store/store';
import { constructAuthMachineState } from '../util/auth';
import path from 'node:path';

function addDiagnosticRecordAndLog(
  store: Store,
  record: Omit<DiagnosticRecord, 'timestamp'>,
  logger: Logger
) {
  store.addDiagnosticRecord(record);
  void logger.logAsCurrentRole(LogEventId.DiagnosticComplete, {
    disposition: record.outcome === 'pass' ? 'success' : 'failure',
    message: `Diagnostic (${record.type}) completed with outcome: ${record.outcome}.`,
    type: record.type,
  });
}

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function buildApi(
  auth: InsertedSmartCardAuthApi,
  usbDrive: UsbDrive,
  logger: Logger,
  workspace: Workspace,
  stateMachine?: PaperHandlerStateMachine,
  paperHandler?: PaperHandlerDriverInterface
) {
  const { store } = workspace;

  return grout.createApi({
    getMachineConfig,

    getAuthStatus() {
      return auth.getAuthStatus(constructAuthMachineState(workspace));
    },

    checkPin(input: { pin: string }) {
      return auth.checkPin(constructAuthMachineState(workspace), {
        pin: input.pin,
      });
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

    updateSessionExpiry(input: { sessionExpiresAt: Date }) {
      return auth.updateSessionExpiry(constructAuthMachineState(workspace), {
        sessionExpiresAt: input.sessionExpiresAt,
      });
    },

    startCardlessVoterSession(input: {
      ballotStyleId: BallotStyleId;
      precinctId: PrecinctId;
    }) {
      return auth.startCardlessVoterSession(
        constructAuthMachineState(workspace),
        {
          ballotStyleId: input.ballotStyleId,
          precinctId: input.precinctId,
        }
      );
    },

    updateCardlessVoterBallotStyle(input: { ballotStyleId: BallotStyleId }) {
      return auth.updateCardlessVoterBallotStyle({
        ballotStyleId: input.ballotStyleId,
      });
    },

    endCardlessVoterSession() {
      stateMachine?.reset();
      return auth.endCardlessVoterSession(constructAuthMachineState(workspace));
    },

    getElectionRecord(): ElectionRecord | null {
      return workspace.store.getElectionRecord() ?? null;
    },

    getSystemSettings(): SystemSettings {
      return workspace.store.getSystemSettings() ?? DEFAULT_SYSTEM_SETTINGS;
    },

    unconfigureMachine() {
      workspace.store.reset();
      void logger.logAsCurrentRole(LogEventId.ElectionUnconfigured, {
        disposition: 'success',
        message:
          'User successfully unconfigured the machine to remove the current election.',
      });
    },

    async configureElectionPackageFromUsb(): Promise<
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

      workspace.store.withTransaction(() => {
        workspace.store.setElectionAndJurisdiction({
          electionData: electionDefinition.electionData,
          jurisdiction: authStatus.user.jurisdiction,
          electionPackageHash,
        });
        workspace.store.setSystemSettings(systemSettings);

        // automatically set precinct for single precinct elections
        if (electionDefinition.election.precincts.length === 1) {
          workspace.store.setPrecinctSelection(
            singlePrecinctSelectionFor(
              electionDefinition.election.precincts[0].id
            )
          );
        }

        configureUiStrings({
          electionPackage,
          logger,
          store: workspace.store.getUiStringsStore(),
        });
      });

      void logger.logAsCurrentRole(LogEventId.ElectionConfigured, {
        message: `Machine configured for election with hash: ${electionDefinition.ballotHash}`,
        disposition: 'success',
        ballotHash: electionDefinition.ballotHash,
      });

      return ok(electionDefinition);
    },

    getPaperHandlerState(): SimpleServerStatus {
      if (!stateMachine) {
        return 'no_hardware';
      }

      return stateMachine.getSimpleStatus();
    },

    setAcceptingPaperState(input: { paperTypes: AcceptedPaperType[] }): void {
      assert(stateMachine);
      stateMachine.setAcceptingPaper(input.paperTypes);
    },

    /**
     * Sets whether the voter has completed the PAT device calibration flow after a device a connected.
     */
    setPatDeviceIsCalibrated(): void {
      assert(stateMachine, 'No state machine');

      stateMachine.setPatDeviceIsCalibrated();
    },

    async printBallot(input: PrintBallotProps): Promise<void> {
      assert(stateMachine);
      store.setBallotsPrintedCount(store.getBallotsPrintedCount() + 1);

      const pdfData = await renderBallot({
        store,
        ...input,
      });
      stateMachine.printBallot(pdfData);
    },

    getInterpretation(): PageInterpretation | null {
      assert(stateMachine);

      // Storing the interpretation in the db requires a somewhat complicated schema
      // and would need to be deleted at the end of the voter session anyway.
      // If we can get away with storing the interpretation in memory only in the
      // state machine we should. This simplifies the logic and reduces the risk
      // of accidentally persisting ballot selections to disk.
      const sheetInterpretation = stateMachine.getInterpretation();

      if (!sheetInterpretation) {
        return null;
      }

      // Omit image data before sending to client. It's long, gets logged, and we don't need it.
      return sheetInterpretation[0].interpretation;
    },

    confirmSessionEnd(): void {
      assert(stateMachine);

      stateMachine.confirmSessionEnd();
    },

    validateBallot(): void {
      assert(stateMachine);

      stateMachine.validateBallot();
    },

    invalidateBallot(): void {
      assert(stateMachine);

      stateMachine.invalidateBallot();
    },

    startSessionWithPreprintedBallot(): void {
      assertDefined(stateMachine).startSessionWithPreprintedBallot();
    },

    returnPreprintedBallot(): void {
      assertDefined(stateMachine).returnPreprintedBallot();
    },

    confirmInvalidateBallot(): void {
      assert(stateMachine);

      void logger.log(LogEventId.BallotInvalidated, 'poll_worker');

      stateMachine.confirmInvalidateBallot();
    },

    async confirmBallotBoxEmptied(): Promise<void> {
      assert(stateMachine);

      const authStatus = await auth.getAuthStatus(
        constructAuthMachineState(workspace)
      );
      assert(isPollWorkerAuth(authStatus), 'Expected pollworker auth');

      workspace.store.setBallotsCastSinceLastBoxChange(0);
      stateMachine.confirmBallotBoxEmptied();

      void logger.log(LogEventId.BallotBoxEmptied, 'poll_worker');
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

    async setPollsState(input: { pollsState: PollsState }) {
      const newPollsState = input.pollsState;
      const oldPollsState = store.getPollsState();
      const numBallotsPrinted = store.getBallotsPrintedCount();

      assert(newPollsState !== 'polls_closed_initial');

      // Confirm there are no printed ballots before opening polls, in compliance
      // with VVSG 2.0 1.1.3-B, even though it should be an impossible app state.
      /* istanbul ignore next - impossible app state */
      if (
        newPollsState === 'polls_open' &&
        oldPollsState === 'polls_closed_initial'
      ) {
        if (numBallotsPrinted !== 0) {
          await logger.logAsCurrentRole(LogEventId.PollsOpened, {
            disposition: 'failure',
            message:
              'Polls can not be opened when there is current ballot data on the machine',
            numBallotsPrinted,
          });
        }
        assert(numBallotsPrinted === 0);
      }

      store.setPollsState(newPollsState);

      const logEvent = (() => {
        switch (newPollsState) {
          case 'polls_closed_final':
            return LogEventId.PollsClosed;
          case 'polls_paused':
            if (oldPollsState === 'polls_closed_final') {
              return LogEventId.ResetPollsToPaused;
            }
            return LogEventId.VotingPaused;
          case 'polls_open':
            if (oldPollsState === 'polls_closed_initial') {
              return LogEventId.PollsOpened;
            }
            return LogEventId.VotingResumed;
          /* istanbul ignore next */
          default:
            throwIllegalValue(newPollsState);
        }
      })();

      void logger.logAsCurrentRole(logEvent, { disposition: 'success' });
    },

    setTestMode(input: { isTestMode: boolean }) {
      const logMessage = input.isTestMode
        ? 'official to test'
        : 'test to official';
      void logger.logAsCurrentRole(LogEventId.TogglingTestMode, {
        message: `Toggling from ${logMessage} mode`,
        isTestMode: input.isTestMode,
      });
      store.setTestMode(input.isTestMode);
      store.setPollsState('polls_closed_initial');
      store.setBallotsPrintedCount(0);
      void logger.logAsCurrentRole(LogEventId.ToggledTestMode, {
        disposition: 'success',
        message: `Successfully toggled from ${logMessage} mode.`,
        isTestMode: input.isTestMode,
      });
    },

    setPrecinctSelection(input: {
      precinctSelection: PrecinctSelection;
    }): void {
      const { electionDefinition } = assertDefined(store.getElectionRecord());
      store.setPrecinctSelection(input.precinctSelection);
      store.setBallotsPrintedCount(0);
      void logger.logAsCurrentRole(LogEventId.PrecinctConfigurationChanged, {
        disposition: 'success',
        message: `User set the precinct for the machine to ${getPrecinctSelectionName(
          electionDefinition.election.precincts,
          input.precinctSelection
        )}`,
      });
    },

    getElectionState(): ElectionState {
      return {
        precinctSelection: store.getPrecinctSelection(),
        ballotsPrintedCount: store.getBallotsPrintedCount(),
        isTestMode: store.getTestMode(),
        pollsState: store.getPollsState(),
      };
    },

    getIsPatDeviceConnected(): boolean {
      if (!stateMachine) {
        return false;
      }

      return stateMachine.isPatDeviceConnected();
    },

    getApplicationDiskSpaceSummary(): Promise<DiskSpaceSummary> {
      return workspace.getDiskSpaceSummary();
    },

    addDiagnosticRecord(input: Omit<DiagnosticRecord, 'timestamp'>): void {
      addDiagnosticRecordAndLog(store, input, logger);
    },

    getMostRecentDiagnostic(input: {
      diagnosticType: DiagnosticType;
    }): DiagnosticRecord | null {
      return store.getMostRecentDiagnosticRecord(input.diagnosticType) ?? null;
    },

    getIsAccessibleControllerInputDetected(): Promise<boolean> {
      return isAccessibleControllerDaemonRunning(workspace.path, logger);
    },

    saveReadinessReport(): Promise<ExportDataResult> {
      return saveReadinessReport({
        workspace,
        usbDrive,
        logger,
        stateMachine: assertDefined(stateMachine),
      });
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

    getMarkScanBmdModel(): BmdModelNumber {
      return getMarkScanBmdModel();
    },

    startPaperHandlerDiagnostic(): void {
      if (!stateMachine) {
        const record: Omit<DiagnosticRecord, 'timestamp'> = {
          type: 'mark-scan-paper-handler',
          outcome: 'fail',
          message: 'Printer/Scanner failed to connect',
        };
        addDiagnosticRecordAndLog(store, record, logger);
        return;
      }

      stateMachine.startPaperHandlerDiagnostic();
    },

    stopPaperHandlerDiagnostic(): void {
      assertDefined(stateMachine).stopPaperHandlerDiagnostic();
    },

    ...buildMockPaperHandlerApi({ paperHandler }),
  });
}

export type Api = ReturnType<typeof buildApi>;

export type { MockPaperHandlerStatus, AcceptedPaperType };

export function buildApp(
  auth: InsertedSmartCardAuthApi,
  logger: Logger,
  workspace: Workspace,
  usbDrive: UsbDrive,
  stateMachine?: PaperHandlerStateMachine,
  paperHandler?: PaperHandlerDriverInterface
): Application {
  const app: Application = express();
  const api = buildApi(
    auth,
    usbDrive,
    logger,
    workspace,
    stateMachine,
    paperHandler
  );
  app.use('/api', grout.buildRouter(api, express));
  useDevDockRouter(app, express, 'mark-scan');

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
