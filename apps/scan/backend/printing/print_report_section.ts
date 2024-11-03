import memoizeOne from 'memoize-one';
import { type PollsTransitionType } from '@vx/libs/types/src';
import { assert, assertDefined } from '@vx/libs/basics/src';
import { isPollsSuspensionTransition } from '@vx/libs/utils/src';
import {
  PrecinctScannerBallotCountReport,
  PrecinctScannerTallyReports,
} from '@vx/libs/ui/reports';
import {
  DEFAULT_MARGIN_DIMENSIONS,
  type MarginDimensions,
  PAPER_DIMENSIONS,
  renderToPdf,
} from '@vx/libs/printing/src';
import { type PrintResult } from '@vx/libs/fujitsu-thermal-printer/src';
import { Store } from '../store/store';
import { getMachineConfig } from '../config/machine_config';
import { getScannerResults } from '../scanning/results';
import { getCurrentTime } from '../time/get_current_time';
import { rootDebug } from '../util/debug';
import { type Printer } from './printer';

const debug = rootDebug.extend('print-report-section');

async function getReportSections(
  store: Store,
  pollsTransitionType: PollsTransitionType,
  pollsTransitionBallotCount: number,
  pollsTransitionTime: number
): Promise<JSX.Element[]> {
  debug('generating all report sections...');
  const { electionDefinition, electionPackageHash } = assertDefined(
    store.getElectionRecord()
  );
  const precinctSelection = store.getPrecinctSelection();
  const isLiveMode = !store.getTestMode();
  const { machineId } = getMachineConfig();
  assert(precinctSelection);

  const scannerResultsByParty = await getScannerResults({ store });

  if (isPollsSuspensionTransition(pollsTransitionType)) {
    return [
      PrecinctScannerBallotCountReport({
        electionDefinition,
        electionPackageHash,
        precinctSelection,
        totalBallotsScanned: pollsTransitionBallotCount,
        pollsTransition: pollsTransitionType,
        pollsTransitionedTime: pollsTransitionTime,
        reportPrintedTime: getCurrentTime(),
        isLiveMode,
        precinctScannerMachineId: machineId,
      }),
    ];
  }

  return PrecinctScannerTallyReports({
    electionDefinition,
    electionPackageHash,
    precinctSelection,
    isLiveMode,
    pollsTransition: pollsTransitionType,
    pollsTransitionedTime: pollsTransitionTime,
    reportPrintedTime: getCurrentTime(),
    precinctScannerMachineId: machineId,
    electionResultsByParty: scannerResultsByParty,
  });
}

const getReportSectionsMemoized = memoizeOne(getReportSections);

async function getReportSection(
  store: Store,
  index: number
): Promise<JSX.Element> {
  debug(`getting report section ${index}...`);
  const pollsTransition = store.getLastPollsTransition();
  assert(pollsTransition);
  assert(pollsTransition.ballotCount === store.getBallotsCounted());

  const allSections = await getReportSectionsMemoized(
    store,
    pollsTransition.type,
    pollsTransition.ballotCount,
    pollsTransition.time
  );

  return allSections[index];
}

/**
 * While loaded, the paper must be fed through the paper output slot with the
 * tear bar. There is a distance between the output slot and the printhead, however,
 * which means that a certain chunk at the top of each page is unprintable. To
 * account for this, we redistribute a certain amount of the top margin to the
 * bottom margin. This must be calibrated based off of the hardware.
 */
const VERTICAL_MARGIN_ADJUSTMENT_INCHES = 0.32;
const ADJUSTED_TOP_MARGIN = Math.max(
  DEFAULT_MARGIN_DIMENSIONS.top - VERTICAL_MARGIN_ADJUSTMENT_INCHES,
  0
);
const ADJUSTED_BOTTOM_MARGIN = Math.max(
  DEFAULT_MARGIN_DIMENSIONS.bottom + VERTICAL_MARGIN_ADJUSTMENT_INCHES,
  0
);
const ADJUSTED_MARGIN_DIMENSIONS: MarginDimensions = {
  ...DEFAULT_MARGIN_DIMENSIONS,
  top: ADJUSTED_TOP_MARGIN,
  bottom: ADJUSTED_BOTTOM_MARGIN,
};

export async function printReportSection({
  store,
  printer,
  index,
}: {
  store: Store;
  printer: Printer;
  index: number;
}): Promise<PrintResult> {
  assert(printer.scheme === 'hardware-v4');
  const section = await getReportSection(store, index);
  const data = (
    await renderToPdf({
      document: section,
      paperDimensions: PAPER_DIMENSIONS.LetterRoll,
      marginDimensions: ADJUSTED_MARGIN_DIMENSIONS,
    })
  ).unsafeUnwrap();
  return printer.print(data);
}
