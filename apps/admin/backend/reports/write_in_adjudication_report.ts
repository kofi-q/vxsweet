import { assert } from '@vx/libs/basics/assert';
import { WriteInAdjudicationReport } from '@vx/libs/ui/reports';
import { type PdfError, renderToPdf } from '@vx/libs/printing/src';
import { type Printer } from '@vx/libs/printing/src/printer';
import { Buffer } from 'node:buffer';
import { LogEventId, Logger } from '@vx/libs/logging/src';
import { Tabulation } from '@vx/libs/types/tabulation';
import { Store } from '../store/store';
import { getCurrentTime } from '../util/time/get_current_time';
import { exportFile } from '../util/exports/export_file';
import { type ExportDataResult } from '@vx/libs/backend/exporter';

function buildWriteInAdjudicationReport({
  store,
  electionWriteInSummary,
}: {
  store: Store;
  electionWriteInSummary: Tabulation.ElectionWriteInSummary;
}): JSX.Element {
  const electionId = store.getCurrentElectionId();
  assert(electionId !== undefined);
  const electionRecord = store.getElection(electionId);
  assert(electionRecord);
  const { electionDefinition, electionPackageHash, isOfficialResults } =
    electionRecord;
  const isTest = store.getCurrentCvrFileModeForElection(electionId) === 'test';

  return WriteInAdjudicationReport({
    electionDefinition,
    electionPackageHash,
    isOfficial: isOfficialResults,
    isTest,
    generatedAtTime: new Date(getCurrentTime()),
    electionWriteInSummary,
  });
}

interface WriteInAdjudicationReportPreviewProps {
  store: Store;
  electionWriteInSummary: Tabulation.ElectionWriteInSummary;
  logger: Logger;
}

interface WriteInAdjudicationReportWarning {
  type: PdfError;
}

/**
 * PDF data for a write-in adjudication report alongside any potential warnings.
 */
export interface WriteInAdjudicationReportPreview {
  pdf?: Buffer;
  warning?: WriteInAdjudicationReportWarning;
}

/**
 * Returns a PDF preview of the write-in adjudication report, as a buffer.
 */
export async function generateWriteInAdjudicationReportPreview({
  logger,

  ...reportProps
}: WriteInAdjudicationReportPreviewProps): Promise<WriteInAdjudicationReportPreview> {
  const result = await (async () => {
    const report = buildWriteInAdjudicationReport(reportProps);
    const pdfResult = await renderToPdf({ document: report });
    return {
      pdf: pdfResult.ok(),
      warning: pdfResult.isErr() ? { type: pdfResult.err() } : undefined,
    };
  })();
  void logger.logAsCurrentRole(LogEventId.ElectionReportPreviewed, {
    message: `User previewed the write-in adjudication report.${
      result.warning ? ` Warning: ${result.warning.type}` : ''
    }`,
    disposition: result.pdf ? 'success' : 'failure',
  });
  return result;
}

/**
 * Generates the write-in adjudication report, sends it to the printer, and
 * logs success or failure.
 */
export async function printWriteInAdjudicationReport({
  printer,
  logger,

  ...reportProps
}: WriteInAdjudicationReportPreviewProps & {
  printer: Printer;
}): Promise<void> {
  const report = buildWriteInAdjudicationReport(reportProps);

  try {
    // Printing is disabled on the frontend if the report preview is too large,
    // so rendering the PDF shouldn't error
    const data = (await renderToPdf({ document: report })).unsafeUnwrap();
    await printer.print({ data });
    void logger.logAsCurrentRole(LogEventId.ElectionReportPrinted, {
      message: `User printed the write-in adjudication report.`,
      disposition: 'success',
    });
  } catch (error) {
    assert(error instanceof Error);
    void logger.logAsCurrentRole(LogEventId.ElectionReportPrinted, {
      message: `Error in attempting to print the write-in adjudication report: ${error.message}`,
      disposition: 'failure',
    });
  }
}

/**
 * Generates the write-in adjudication report and exports it as a PDF file on
 * the USB drive.
 */
export async function exportWriteInAdjudicationReportPdf({
  path,
  logger,

  ...reportProps
}: WriteInAdjudicationReportPreviewProps & {
  path: string;
}): Promise<ExportDataResult> {
  const report = buildWriteInAdjudicationReport(reportProps);
  // Printing is disabled on the frontend if the report preview is too large,
  // so rendering the PDF shouldn't error
  const data = (await renderToPdf({ document: report })).unsafeUnwrap();
  const exportFileResult = await exportFile({ path, data });

  void logger.logAsCurrentRole(LogEventId.FileSaved, {
    disposition: exportFileResult.isOk() ? 'success' : 'failure',
    message: `${
      exportFileResult.isOk() ? 'Saved' : 'Failed to save'
    } write-in adjudication report PDF file to ${path} on the USB drive.`,
    filename: path,
  });

  return exportFileResult;
}
