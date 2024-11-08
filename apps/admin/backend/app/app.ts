import { Buffer } from 'node:buffer';
import { isMatch } from 'micromatch';
import { LogEventId, Logger } from '@vx/libs/logging/src';
import { Admin } from '@vx/libs/types/admin';
import { type DiagnosticRecord } from '@vx/libs/types/diagnostics';
import { type Id } from '@vx/libs/types/basic';
import { type PrinterStatus } from '@vx/libs/types/printing';
import { Tabulation } from '@vx/libs/types/tabulation';
import { convertElectionResultsReportingReportToVxManualResults } from '@vx/libs/types/cdf';
import {
  ElectionPackageFileName,
  type ContestId,
  DEFAULT_SYSTEM_SETTINGS,
  type SystemSettings,
} from '@vx/libs/types/elections';
import { CastVoteRecordExportFileName } from '@vx/libs/types/cvrs';
import { assert, assertDefined } from '@vx/libs/basics/assert';
import { deferred } from '@vx/libs/basics/async';
import { err, ok, type Result } from '@vx/libs/basics/result';
import { type Optional } from '@vx/libs/basics/types';
import express, { Application } from 'express';
import { type DippedSmartCardAuthApi } from '@vx/libs/auth/dipped-cards';
import { generateSignedHashValidationQrCodeValue } from '@vx/libs/auth/validation';
import { prepareSignatureFile } from '@vx/libs/auth/artifacts';
import * as grout from '@vx/libs/grout/src';
import { useDevDockRouter } from '@vx/libs/dev-dock/backend/src';
import { type Printer } from '@vx/libs/printing/src/printer';
import { createReadStream, promises as fs } from 'node:fs';
import path, { join } from 'node:path';
import {
  ELECTION_PACKAGE_FOLDER,
  generateElectionBasedSubfolderName,
  generateFilenameForElectionPackage,
  isIntegrationTest,
} from '@vx/libs/utils/src';
import {
  getBallotCount,
  groupMapToGroupList,
} from '@vx/libs/utils/src/tabulation';
import { dirSync } from 'tmp';
import { type DiskSpaceSummary } from '@vx/libs/backend/diagnostics';
import {
  type ExportDataError,
  type ExportDataResult,
} from '@vx/libs/backend/exporter';
import {
  type ElectionPackageError,
  type ElectionPackageWithFileContents,
  readElectionPackageFromBuffer,
  readElectionPackageFromFile,
} from '@vx/libs/backend/election_package';
import { createSystemCallApi } from '@vx/libs/backend/system_call';
import {
  type FileSystemEntry,
  FileSystemEntryType,
  readElection,
} from '@vx/libs/fs/src';
import {
  type ListDirectoryOnUsbDriveError,
  listDirectoryOnUsbDrive,
  type UsbDrive,
  type UsbDriveStatus,
} from '@vx/libs/usb-drive/src';
import ZipStream from 'zip-stream';
import {
  type CastVoteRecordFileRecord,
  type CvrFileImportInfo,
  type CvrFileMode,
  type ElectionRecord,
  type ImportCastVoteRecordsError,
  type ManualResultsIdentifier,
  type ManualResultsRecord,
  type ScannerBatch,
  type WriteInAdjudicationAction,
  type WriteInAdjudicationQueueMetadata,
  type WriteInAdjudicationStatus,
  type WriteInCandidateRecord,
  type WriteInAdjudicationContext,
  type WriteInImageView,
  type ImportElectionResultsReportingError,
  type ManualResultsMetadata,
} from '../types/types';
import { type Workspace } from '../workspace/workspace';
import { getMachineConfig } from '../machine-config/machine_config';
import {
  getWriteInAdjudicationContext,
  getWriteInImageView,
} from '../util/write-ins/write_ins';
import {
  transformWriteInsAndSetManualResults,
  validateManualResults,
} from '../util/manual-results/manual_results';
import { addFileToZipStream } from '../util/zip/zip';
import { exportFile } from '../util/exports/export_file';
import { generateTallyReportCsv } from '../exports/csv_tally_report';
import { tabulateFullCardCounts } from '../tabulation/card_counts';
import { getOverallElectionWriteInSummary } from '../tabulation/write_ins';
import { rootDebug } from '../util/logging/debug';
import { tabulateTallyReportResults } from '../tabulation/tally_reports';
import { buildExporter } from '../util/exports/exporter';
import {
  importCastVoteRecords,
  listCastVoteRecordExportsOnUsbDrive,
} from '../cvrs/cast_vote_records';
import { generateBallotCountReportCsv } from '../exports/csv_ballot_count_report';
import { adjudicateWriteIn } from '../adjudication/adjudication';
import { convertFrontendFilter as convertFrontendFilterUtil } from '../util/filters/filters';
import { buildElectionResultsReport } from '../util/cdf/cdf_results';
import { tabulateElectionResults } from '../tabulation/full_results';
import { NODE_ENV, REAL_USB_DRIVE_GLOB_PATTERN } from '../globals/globals';
import {
  exportWriteInAdjudicationReportPdf,
  generateWriteInAdjudicationReportPreview,
  printWriteInAdjudicationReport,
  type WriteInAdjudicationReportPreview,
} from '../reports/write_in_adjudication_report';
import {
  type BallotCountReportPreview,
  type BallotCountReportSpec,
  exportBallotCountReportPdf,
  generateBallotCountReportPreview,
  printBallotCountReport,
} from '../reports/ballot_count_report';
import {
  type TallyReportSpec,
  type TallyReportPreview,
  generateTallyReportPreview,
  printTallyReport,
  exportTallyReportPdf,
} from '../reports/tally_report';
import { printTestPage } from '../reports/test_print';
import { saveReadinessReport } from '../reports/readiness';
import { constructAuthMachineState } from '../util/auth/auth';
import { parseElectionResultsReportingFile } from '../tabulation/election_results_reporting';

const debug = rootDebug.extend('app');

function loadCurrentElectionIdOrThrow(workspace: Workspace) {
  return assertDefined(workspace.store.getCurrentElectionId());
}

function getCurrentElectionRecord(
  workspace: Workspace
): Optional<ElectionRecord> {
  const electionId = workspace.store.getCurrentElectionId();
  /* istanbul ignore next */
  if (!electionId) {
    return undefined;
  }
  const electionRecord = workspace.store.getElection(electionId);
  assert(electionRecord);
  return electionRecord;
}

function buildApi({
  auth,
  workspace,
  logger,
  usbDrive,
  printer,
}: {
  auth: DippedSmartCardAuthApi;
  workspace: Workspace;
  logger: Logger;
  usbDrive: UsbDrive;
  printer: Printer;
}) {
  const { store } = workspace;

  function convertFrontendFilter(
    filter: Admin.FrontendReportingFilter
  ): Optional<Admin.ReportingFilter> {
    const electionId = loadCurrentElectionIdOrThrow(workspace);
    const {
      electionDefinition: { election },
    } = assertDefined(store.getElection(electionId));
    return convertFrontendFilterUtil(filter, election);
  }

  function getTallyReportResults(
    input: Pick<TallyReportSpec, 'filter' | 'groupBy'>
  ): Promise<Tabulation.GroupList<Admin.TallyReportResults>> {
    const electionId = loadCurrentElectionIdOrThrow(workspace);
    return tabulateTallyReportResults({
      electionId,
      store,
      filter: convertFrontendFilter(input.filter),
      groupBy: input.groupBy,
    });
  }

  function getCardCounts(
    input: Pick<BallotCountReportSpec, 'filter' | 'groupBy'>
  ): Tabulation.GroupList<Tabulation.CardCounts> {
    const electionId = loadCurrentElectionIdOrThrow(workspace);
    return groupMapToGroupList(
      tabulateFullCardCounts({
        electionId,
        store,
        filter: convertFrontendFilter(input.filter),
        groupBy: input.groupBy,
      })
    );
  }

  function getElectionWriteInSummary(): Tabulation.ElectionWriteInSummary {
    const electionId = loadCurrentElectionIdOrThrow(workspace);
    return getOverallElectionWriteInSummary({
      electionId,
      store,
    });
  }

  return grout.createApi({
    getMachineConfig,

    getAuthStatus() {
      return auth.getAuthStatus(constructAuthMachineState(workspace));
    },

    checkPin(input: { pin: string }) {
      return auth.checkPin(constructAuthMachineState(workspace), input);
    },

    logOut() {
      return auth.logOut(constructAuthMachineState(workspace));
    },

    updateSessionExpiry(input: { sessionExpiresAt: Date }) {
      return auth.updateSessionExpiry(
        constructAuthMachineState(workspace),
        input
      );
    },

    programCard(input: {
      userRole: 'system_administrator' | 'election_manager' | 'poll_worker';
    }) {
      return auth.programCard(constructAuthMachineState(workspace), {
        userRole: input.userRole,
      });
    },

    unprogramCard() {
      return auth.unprogramCard(constructAuthMachineState(workspace));
    },

    getPrinterStatus(): Promise<PrinterStatus> {
      return printer.status();
    },

    /* istanbul ignore next */
    async generateSignedHashValidationQrCodeValue() {
      const { codeVersion, machineId } = getMachineConfig();
      const electionRecord = getCurrentElectionRecord(workspace);
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

    getUsbDriveStatus(): Promise<UsbDriveStatus> {
      return usbDrive.status();
    },

    ejectUsbDrive(): Promise<void> {
      return usbDrive.eject();
    },

    async formatUsbDrive(): Promise<Result<void, Error>> {
      try {
        await usbDrive.format();
        return ok();
      } catch (error) {
        return err(error as Error);
      }
    },

    async saveElectionPackageToUsb(): Promise<Result<void, ExportDataError>> {
      void logger.logAsCurrentRole(LogEventId.SaveElectionPackageInit);
      const exporter = buildExporter(usbDrive);

      const electionRecord = getCurrentElectionRecord(workspace);
      assert(electionRecord);
      const { electionDefinition, id: electionId } = electionRecord;
      const { election, ballotHash } = electionDefinition;

      const tempDirectory = dirSync().name;
      try {
        const electionPackageFileName = generateFilenameForElectionPackage(
          new Date()
        );
        const tempDirectoryElectionPackageFilePath = join(
          tempDirectory,
          electionPackageFileName
        );
        await fs.writeFile(
          tempDirectoryElectionPackageFilePath,
          assertDefined(
            workspace.store.getElectionPackageFileContents(electionId)
          )
        );

        const usbDriveElectionPackageDirectoryRelativePath = join(
          generateElectionBasedSubfolderName(election, ballotHash),
          ELECTION_PACKAGE_FOLDER
        );
        const exportElectionPackageResult = await exporter.exportDataToUsbDrive(
          usbDriveElectionPackageDirectoryRelativePath,
          electionPackageFileName,
          createReadStream(tempDirectoryElectionPackageFilePath)
        );
        if (exportElectionPackageResult.isErr()) {
          return exportElectionPackageResult;
        }

        const signatureFile = await prepareSignatureFile({
          type: 'election_package',
          // For protection against compromised/faulty USBs, we sign data as it exists on the
          // machine, not the USB, as a compromised/faulty USB could claim to have written the data
          // that we asked it to but actually have written something else.
          filePath: tempDirectoryElectionPackageFilePath,
        });
        const exportSignatureFileResult = await exporter.exportDataToUsbDrive(
          usbDriveElectionPackageDirectoryRelativePath,
          signatureFile.fileName,
          signatureFile.fileContents
        );
        /* istanbul ignore next: Tricky to make this second export err but the first export succeed
          without significant mocking */
        if (exportSignatureFileResult.isErr()) {
          return exportSignatureFileResult;
        }
      } finally {
        await fs.rm(tempDirectory, { recursive: true });
      }

      void logger.logAsCurrentRole(LogEventId.SaveElectionPackageComplete, {
        disposition: 'success',
        message: 'Successfully saved election package.',
      });
      return ok();
    },

    getSystemSettings(): SystemSettings {
      const electionId = store.getCurrentElectionId();
      if (!electionId) {
        return DEFAULT_SYSTEM_SETTINGS;
      }

      return store.getSystemSettings(electionId);
    },

    async listPotentialElectionPackagesOnUsbDrive(): Promise<
      Result<FileSystemEntry[], ListDirectoryOnUsbDriveError>
    > {
      const potentialElectionPackages: FileSystemEntry[] = [];

      for await (const result of listDirectoryOnUsbDrive(usbDrive, '')) {
        if (result.isErr()) {
          return result;
        }

        const entry = result.ok();

        if (
          entry.type === FileSystemEntryType.File &&
          entry.name.endsWith('.zip') &&
          !entry.name.startsWith('.') &&
          !entry.name.startsWith('_')
        ) {
          potentialElectionPackages.push(entry);
        }
      }

      return ok(
        // Most recent first
        [...potentialElectionPackages].sort(
          (a, b) => b.ctime.getTime() - a.ctime.getTime()
        )
      );
    },

    // `configure` and `unconfigure` handle changes to the election definition
    async configure(input: {
      electionFilePath: string;
    }): Promise<Result<{ electionId: Id }, ElectionPackageError>> {
      // A check for defense-in-depth
      assert(
        NODE_ENV === 'production' && !isIntegrationTest()
          ? isMatch(input.electionFilePath, REAL_USB_DRIVE_GLOB_PATTERN)
          : true,
        'Can only import election packages from removable media in production'
      );

      const electionPackageResult: Result<
        ElectionPackageWithFileContents,
        ElectionPackageError
      > = await (async () => {
        if (input.electionFilePath.endsWith('.json')) {
          const electionDefinitionResult = await readElection(
            input.electionFilePath
          );
          if (electionDefinitionResult.isErr()) {
            return err({
              type: 'invalid-election',
              message: electionDefinitionResult.err().toString(),
            });
          }
          const electionDefinition = electionDefinitionResult.ok();
          const systemSettings = DEFAULT_SYSTEM_SETTINGS;

          const zipStream = new ZipStream();
          const zipPromise = deferred<void>();
          const chunks: Buffer[] = [];
          zipStream.on('error', zipPromise.reject);
          zipStream.on('end', zipPromise.resolve);
          zipStream.on('data', (chunk) => {
            assert(Buffer.isBuffer(chunk));
            chunks.push(chunk);
          });
          await addFileToZipStream(zipStream, {
            path: ElectionPackageFileName.ELECTION,
            contents: electionDefinition.electionData,
          });
          await addFileToZipStream(zipStream, {
            path: ElectionPackageFileName.SYSTEM_SETTINGS,
            contents: JSON.stringify(systemSettings, null, 2),
          });
          zipStream.finish();
          await zipPromise.promise;
          const fileContents = Buffer.concat(chunks);
          const result = await readElectionPackageFromBuffer(fileContents);
          /* istanbul ignore next */
          return result.isErr() ? result : ok({ ...result.ok(), fileContents });
        }
        return await readElectionPackageFromFile(input.electionFilePath);
      })();

      if (electionPackageResult.isErr()) {
        void logger.logAsCurrentRole(LogEventId.ElectionConfigured, {
          message: `Error configuring machine.`,
          disposition: 'failure',
          errorDetails: JSON.stringify(electionPackageResult.err()),
        });
        return electionPackageResult;
      }
      const { electionPackage, electionPackageHash, fileContents } =
        electionPackageResult.ok();

      const { electionDefinition, systemSettings } = electionPackage;
      const electionId = store.addElection({
        electionData: electionDefinition.electionData,
        systemSettingsData: JSON.stringify(systemSettings),
        electionPackageFileContents: fileContents,
        electionPackageHash,
      });
      store.setCurrentElectionId(electionId);
      void logger.logAsCurrentRole(LogEventId.ElectionConfigured, {
        disposition: 'success',
        newBallotHash: electionDefinition.ballotHash,
      });
      return ok({ electionId });
    },

    unconfigure(): void {
      store.deleteElection(loadCurrentElectionIdOrThrow(workspace));
      void logger.logAsCurrentRole(LogEventId.ElectionUnconfigured, {
        disposition: 'success',
      });
    },

    // use null because React Query does not allow undefined as a query result
    getCurrentElectionMetadata(): ElectionRecord | null {
      const currentElectionId = store.getCurrentElectionId();
      if (currentElectionId) {
        const electionRecord = store.getElection(currentElectionId);
        assert(electionRecord);
        return electionRecord;
      }

      return null;
    },

    markResultsOfficial(): void {
      store.setElectionResultsOfficial(
        loadCurrentElectionIdOrThrow(workspace),
        true
      );

      void logger.logAsCurrentRole(LogEventId.MarkedTallyResultsOfficial, {
        message:
          'User has marked the tally results as official, no more cast vote record files can be loaded.',
        disposition: 'success',
      });
    },

    async listCastVoteRecordFilesOnUsb() {
      const electionRecord = assertDefined(getCurrentElectionRecord(workspace));
      const { electionDefinition } = electionRecord;

      const listResult = await listCastVoteRecordExportsOnUsbDrive(
        usbDrive,
        electionDefinition
      );
      if (listResult.isErr()) {
        void logger.logAsCurrentRole(
          LogEventId.ListCastVoteRecordExportsOnUsbDrive,
          {
            disposition: 'failure',
            message: 'Error listing cast vote record exports on USB drive.',
            reason: listResult.err(),
          }
        );
        return [];
      }
      const castVoteRecordExportSummaries = listResult.ok();
      void logger.logAsCurrentRole(
        LogEventId.ListCastVoteRecordExportsOnUsbDrive,
        {
          disposition: 'success',
          message: `Found ${castVoteRecordExportSummaries.length} cast vote record export(s) on USB drive.`,
        }
      );
      return castVoteRecordExportSummaries;
    },

    getCastVoteRecordFiles(): CastVoteRecordFileRecord[] {
      return store.getCvrFiles(loadCurrentElectionIdOrThrow(workspace));
    },

    async addCastVoteRecordFile(input: {
      path: string;
    }): Promise<Result<CvrFileImportInfo, ImportCastVoteRecordsError>> {
      void logger.logAsCurrentRole(LogEventId.ImportCastVoteRecordsInit, {
        message: 'Importing cast vote records...',
      });
      const exportDirectoryPath =
        // For manual export selection, users must select the contained metadata file as a proxy
        // for the export directory since the UI doesn't support directory selection
        path.basename(input.path) === CastVoteRecordExportFileName.METADATA
          ? path.dirname(input.path)
          : input.path;
      const importResult = await importCastVoteRecords(
        store,
        exportDirectoryPath
      );
      if (importResult.isErr()) {
        void logger.logAsCurrentRole(LogEventId.ImportCastVoteRecordsComplete, {
          disposition: 'failure',
          message: 'Error importing cast vote records.',
          exportDirectoryPath,
          errorDetails: JSON.stringify(importResult.err()),
        });
      } else {
        const { alreadyPresent: numAlreadyPresent, newlyAdded: numNewlyAdded } =
          importResult.ok();
        let message = `Successfully imported ${numNewlyAdded} cast vote record(s).`;
        if (numAlreadyPresent > 0) {
          message += ` Ignored ${numAlreadyPresent} duplicate(s).`;
        }
        void logger.logAsCurrentRole(LogEventId.ImportCastVoteRecordsComplete, {
          disposition: 'success',
          message,
          exportDirectoryPath,
        });
      }
      return importResult;
    },

    clearCastVoteRecordFiles(): void {
      void logger.logAsCurrentRole(
        LogEventId.ClearImportedCastVoteRecordsInit,
        {
          message: 'Clearing imported cast vote records...',
        }
      );
      const electionId = loadCurrentElectionIdOrThrow(workspace);
      store.deleteCastVoteRecordFiles(electionId);
      store.setElectionResultsOfficial(electionId, false);
      void logger.logAsCurrentRole(
        LogEventId.ClearImportedCastVoteRecordsComplete,
        {
          disposition: 'success',
          message: 'Successfully cleared all imported cast vote records.',
        }
      );
    },

    getCastVoteRecordFileMode(): CvrFileMode {
      return store.getCurrentCvrFileModeForElection(
        loadCurrentElectionIdOrThrow(workspace)
      );
    },

    getWriteInAdjudicationQueue(
      input: {
        contestId?: ContestId;
      } = {}
    ): Id[] {
      return store.getWriteInAdjudicationQueue({
        electionId: loadCurrentElectionIdOrThrow(workspace),
        ...input,
      });
    },

    getFirstPendingWriteInId(input: { contestId: ContestId }): Id | null {
      return (
        store.getFirstPendingWriteInId({
          electionId: loadCurrentElectionIdOrThrow(workspace),
          ...input,
        }) ?? null
      );
    },

    adjudicateWriteIn(input: WriteInAdjudicationAction): void {
      adjudicateWriteIn(input, store, logger);
    },

    getWriteInAdjudicationQueueMetadata(
      input: {
        contestId?: ContestId;
        status?: WriteInAdjudicationStatus;
      } = {}
    ): WriteInAdjudicationQueueMetadata[] {
      return store.getWriteInAdjudicationQueueMetadata({
        electionId: loadCurrentElectionIdOrThrow(workspace),
        ...input,
      });
    },

    getWriteInCandidates(
      input: {
        contestId?: ContestId;
      } = {}
    ): WriteInCandidateRecord[] {
      return store.getWriteInCandidates({
        electionId: loadCurrentElectionIdOrThrow(workspace),
        ...input,
      });
    },

    addWriteInCandidate(input: {
      contestId: ContestId;
      name: string;
    }): WriteInCandidateRecord {
      return store.addWriteInCandidate({
        electionId: loadCurrentElectionIdOrThrow(workspace),
        ...input,
      });
    },

    getWriteInImageView(input: {
      writeInId: string;
    }): Promise<WriteInImageView> {
      return getWriteInImageView({
        store: workspace.store,
        writeInId: input.writeInId,
      });
    },

    getWriteInAdjudicationContext(input: {
      writeInId: string;
    }): WriteInAdjudicationContext {
      return getWriteInAdjudicationContext({
        store: workspace.store,
        writeInId: input.writeInId,
      });
    },

    deleteAllManualResults(): void {
      store.deleteAllManualResults({
        electionId: loadCurrentElectionIdOrThrow(workspace),
      });
      void logger.logAsCurrentRole(LogEventId.ManualTallyDataRemoved, {
        message: 'User removed all manually entered tally data.',
        disposition: 'success',
      });
    },

    deleteManualResults(input: ManualResultsIdentifier): void {
      store.deleteManualResults({
        electionId: loadCurrentElectionIdOrThrow(workspace),
        ...input,
      });
      void logger.logAsCurrentRole(LogEventId.ManualTallyDataRemoved, {
        message:
          'User removed manually entered tally data for a particular ballot style, precinct, and voting method.',
        ...input,
        disposition: 'success',
      });
    },

    async setManualResults(
      input: ManualResultsIdentifier & {
        manualResults: Tabulation.ManualElectionResults;
      }
    ): Promise<void> {
      const electionId = loadCurrentElectionIdOrThrow(workspace);
      await transformWriteInsAndSetManualResults({
        manualResults: input.manualResults,
        electionId,
        store,
        precinctId: input.precinctId,
        ballotStyleGroupId: input.ballotStyleGroupId,
        votingMethod: input.votingMethod,
      });

      void logger.logAsCurrentRole(LogEventId.ManualTallyDataEdited, {
        disposition: 'success',
        message:
          'User added or edited manually entered tally data for a particular ballot style, precinct, and voting method.',
        ballotCount: input.manualResults.ballotCount,
        ballotStyleGroupId: input.ballotStyleGroupId,
        precinctId: input.precinctId,
        ballotType: input.votingMethod,
      });
    },

    getManualResults(
      input: ManualResultsIdentifier
    ): ManualResultsRecord | null {
      const [manualResultsRecord] = store.getManualResults({
        electionId: loadCurrentElectionIdOrThrow(workspace),
        filter: {
          precinctIds: [input.precinctId],
          ballotStyleGroupIds: [input.ballotStyleGroupId],
          votingMethods: [input.votingMethod],
        },
      });

      return manualResultsRecord ?? null;
    },

    getManualResultsMetadata(): ManualResultsMetadata[] {
      const electionId = loadCurrentElectionIdOrThrow(workspace);
      const manualResultsRecords = store.getManualResults({
        electionId,
      });
      const {
        electionDefinition: { election },
      } = assertDefined(store.getElection(electionId));
      return manualResultsRecords.map((record) => {
        const { manualResults, ...metadata } = record;
        return {
          ...metadata,
          ballotCount: manualResults.ballotCount,
          validationError: validateManualResults(election, record),
        };
      });
    },

    // Parses the given ERR file and treats it as manual results.
    async importElectionResultsReportingFile(
      input: ManualResultsIdentifier & {
        filepath: string;
      }
    ): Promise<Result<void, ImportElectionResultsReportingError>> {
      const electionId = loadCurrentElectionIdOrThrow(workspace);
      const electionRecord = store.getElection(electionId);
      assert(electionRecord);
      const { electionDefinition } = electionRecord;

      // Get the set of valid candidate IDs. File conversion will error
      // if it encounters a non-write-in candidate ID not in this list.
      const candidateIds = new Set<string>();
      for (const contest of electionDefinition.election.contests) {
        if (contest.type === 'candidate') {
          for (const candidate of contest.candidates) {
            candidateIds.add(candidate.id);
          }
        }
      }

      const parseResult = await parseElectionResultsReportingFile(
        input.filepath,
        logger
      );

      if (parseResult.isErr()) {
        // Logging is handled by parseElectionResultsReportingFile
        return err({ type: 'parsing-failed' });
      }

      const electionReport = parseResult.ok();
      const wrappedManualResults =
        convertElectionResultsReportingReportToVxManualResults(
          electionReport,
          candidateIds
        );

      if (wrappedManualResults.isErr()) {
        void logger.logAsCurrentRole(LogEventId.ParseError, {
          message: 'Error converting ERR file to VX format',
          error: wrappedManualResults.err().message,
        });
        return err({ type: 'conversion-failed' });
      }

      const manualResults = wrappedManualResults.ok();

      await transformWriteInsAndSetManualResults({
        manualResults,
        electionId,
        store,
        precinctId: input.precinctId,
        ballotStyleGroupId: input.ballotStyleGroupId,
        votingMethod: input.votingMethod,
      });

      void logger.logAsCurrentRole(
        LogEventId.ElectionResultsReportingTallyFileImported,
        {
          disposition: 'success',
          message:
            'User imported an Election Results Reporting file with tally data for a particular ballot style, precinct, and voting method.',
          ballotCount: manualResults.ballotCount,
          ballotStyleGroupId: input.ballotStyleGroupId,
          precinctId: input.precinctId,
          ballotType: input.votingMethod,
        }
      );

      return ok();
    },

    getScannerBatches(): ScannerBatch[] {
      return store.getScannerBatches(loadCurrentElectionIdOrThrow(workspace));
    },

    getResultsForTallyReports(
      input: Pick<TallyReportSpec, 'filter' | 'groupBy'> = {
        filter: {},
        groupBy: {},
      }
    ): Promise<Tabulation.GroupList<Admin.TallyReportResults>> {
      return getTallyReportResults(input);
    },

    async getTallyReportPreview(
      input: TallyReportSpec
    ): Promise<TallyReportPreview> {
      return generateTallyReportPreview({
        store,
        allTallyReportResults: await getTallyReportResults(input),
        ...input,
        logger,
      });
    },

    async printTallyReport(input: TallyReportSpec): Promise<void> {
      return printTallyReport({
        store,
        allTallyReportResults: await getTallyReportResults(input),
        ...input,
        logger,
        printer,
      });
    },

    async exportTallyReportPdf(
      input: TallyReportSpec & { path: string }
    ): Promise<ExportDataResult> {
      return await exportTallyReportPdf({
        store,
        allTallyReportResults: await getTallyReportResults(input),
        ...input,
        logger,
      });
    },

    async exportTallyReportCsv(
      input: Pick<TallyReportSpec, 'filter' | 'groupBy'> & {
        path: string;
      }
    ): Promise<ExportDataResult> {
      debug('exporting tally report CSV file: %o', input);
      const exportFileResult = await exportFile({
        path: input.path,
        data: generateTallyReportCsv({
          store,
          filter: convertFrontendFilter(input.filter),
          groupBy: input.groupBy,
        }),
      });

      void logger.logAsCurrentRole(LogEventId.FileSaved, {
        disposition: exportFileResult.isOk() ? 'success' : 'failure',
        message: `${
          exportFileResult.isOk() ? 'Saved' : 'Failed to save'
        } tally report CSV file to ${input.path} on the USB drive.`,
        filename: input.path,
      });

      return exportFileResult;
    },

    async exportCdfElectionResultsReport(input: {
      path: string;
    }): Promise<ExportDataResult> {
      const electionId = loadCurrentElectionIdOrThrow(workspace);
      const electionRecord = store.getElection(electionId);
      assert(electionRecord);
      const {
        isOfficialResults,
        electionDefinition: { election },
      } = electionRecord;

      const isTestMode =
        store.getCurrentCvrFileModeForElection(electionId) === 'test';
      const writeInCandidates = store.getWriteInCandidates({ electionId });

      const electionResults = groupMapToGroupList(
        await tabulateElectionResults({
          electionId,
          store,
          includeWriteInAdjudicationResults: true,
          includeManualResults: true,
        })
      )[0];
      assert(electionResults);

      debug('exporting CDF election results report JSON file: %o', input);

      const exportFileResult = await exportFile({
        path: input.path,
        data: JSON.stringify(
          buildElectionResultsReport({
            election,
            electionResults,
            isOfficialResults,
            isTestMode,
            writeInCandidates,
            machineConfig: getMachineConfig(),
          })
        ),
      });

      void logger.logAsCurrentRole(LogEventId.FileSaved, {
        disposition: exportFileResult.isOk() ? 'success' : 'failure',
        message: `${
          exportFileResult.isOk() ? 'Saved' : 'Failed to save'
        } CDF election results report JSON file to ${
          input.path
        } on the USB drive.`,
        filename: input.path,
      });

      return exportFileResult;
    },

    getCardCounts(
      input: Pick<BallotCountReportSpec, 'filter' | 'groupBy'>
    ): Array<Tabulation.GroupOf<Tabulation.CardCounts>> {
      return getCardCounts(input);
    },

    getTotalBallotCount(): number {
      const [cardCounts] = getCardCounts({
        filter: {},
        groupBy: {},
      });
      assert(cardCounts);
      return getBallotCount(cardCounts);
    },

    getBallotCountReportPreview(
      input: BallotCountReportSpec
    ): Promise<BallotCountReportPreview> {
      return generateBallotCountReportPreview({
        store,
        allCardCounts: getCardCounts(input),
        ...input,
        logger,
      });
    },

    printBallotCountReport(input: BallotCountReportSpec): Promise<void> {
      return printBallotCountReport({
        store,
        allCardCounts: getCardCounts(input),
        ...input,
        logger,
        printer,
      });
    },

    exportBallotCountReportPdf(
      input: BallotCountReportSpec & { path: string }
    ): Promise<ExportDataResult> {
      return exportBallotCountReportPdf({
        store,
        allCardCounts: getCardCounts(input),
        ...input,
        logger,
      });
    },

    async exportBallotCountReportCsv(
      input: BallotCountReportSpec & {
        path: string;
      }
    ): Promise<ExportDataResult> {
      debug('exporting ballot count report CSV file: %o', input);
      const exportFileResult = await exportFile({
        path: input.path,
        data: generateBallotCountReportCsv({
          store,
          filter: convertFrontendFilter(input.filter),
          groupBy: input.groupBy,
          includeSheetCounts: input.includeSheetCounts,
        }),
      });

      void logger.logAsCurrentRole(LogEventId.FileSaved, {
        disposition: exportFileResult.isOk() ? 'success' : 'failure',
        message: `${
          exportFileResult.isOk() ? 'Saved' : 'Failed to save'
        } ballot count report CSV file to ${input.path} on the USB drive.`,
        filename: input.path,
      });

      return exportFileResult;
    },

    getElectionWriteInSummary(): Tabulation.ElectionWriteInSummary {
      return getElectionWriteInSummary();
    },

    getWriteInAdjudicationReportPreview(): Promise<WriteInAdjudicationReportPreview> {
      return generateWriteInAdjudicationReportPreview({
        store,
        electionWriteInSummary: getElectionWriteInSummary(),
        logger,
      });
    },

    printWriteInAdjudicationReport(): Promise<void> {
      return printWriteInAdjudicationReport({
        store,
        electionWriteInSummary: getElectionWriteInSummary(),
        logger,
        printer,
      });
    },

    exportWriteInAdjudicationReportPdf(input: {
      path: string;
    }): Promise<ExportDataResult> {
      return exportWriteInAdjudicationReportPdf({
        store,
        electionWriteInSummary: getElectionWriteInSummary(),
        logger,
        path: input.path,
      });
    },

    addDiagnosticRecord(input: Omit<DiagnosticRecord, 'timestamp'>): void {
      store.addDiagnosticRecord(input);
      void logger.logAsCurrentRole(LogEventId.DiagnosticComplete, {
        disposition: input.outcome === 'pass' ? 'success' : 'failure',
        message: `Diagnostic (${input.type}) completed with outcome: ${input.outcome}.`,
      });
    },

    getMostRecentPrinterDiagnostic(): DiagnosticRecord | null {
      return store.getMostRecentDiagnosticRecord('test-print') ?? null;
    },

    async printTestPage(): Promise<void> {
      await printTestPage({
        printer,
        logger,
      });
    },

    saveReadinessReport(): Promise<ExportDataResult> {
      return saveReadinessReport({
        workspace,
        printer,
        usbDrive,
        logger,
      });
    },

    getApplicationDiskSpaceSummary(): Promise<DiskSpaceSummary> {
      return workspace.getDiskSpaceSummary();
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
export type Api = ReturnType<typeof buildApi>;

/**
 * Builds an express application.
 */
export function buildApp({
  auth,
  workspace,
  logger,
  usbDrive,
  printer,
}: {
  auth: DippedSmartCardAuthApi;
  workspace: Workspace;
  logger: Logger;
  usbDrive: UsbDrive;
  printer: Printer;
}): Application {
  const app: Application = express();
  const api = buildApi({ auth, workspace, logger, usbDrive, printer });
  app.use('/api', grout.buildRouter(api, express));
  useDevDockRouter(app, express, 'admin');

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
