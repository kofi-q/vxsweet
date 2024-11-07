import { Button } from '@vx/libs/ui/buttons';
import { CenteredLargeProse } from '@vx/libs/ui/src';
import { LoadingAnimation } from '@vx/libs/ui/spinners';
import { H1, P } from '@vx/libs/ui/primitives';
import { getPartyIdsForPrecinctScannerTallyReports } from '@vx/libs/ui/reports';
import React, { useCallback, useState } from 'react';
import {
  type ElectionDefinition,
  type PollsTransitionType,
} from '@vx/libs/types/src';
import { type Optional } from '@vx/libs/basics/types';
import { assert } from '@vx/libs/basics/assert';
import { getPartyById } from '@vx/libs/utils/src/tabulation';
import {
  getPollsReportTitle,
  isPollsSuspensionTransition,
} from '@vx/libs/utils/src';
import { type FujitsuPrintResult } from '../../../backend/printing/printer';
import { Screen, getPostPollsTransitionHeaderText } from './poll_worker_shared';
import { getPrinterStatus, printReportSection } from '../../api/api';
import { PollWorkerLoadAndReprintButton } from '../../components/printer_management/poll_worker_load_and_reprint_button';

function getReportManifest(
  electionDefinition: ElectionDefinition,
  pollsTransitionType: PollsTransitionType
): string[] | undefined {
  // the polls paused and resumed reports are not separated by party even in a primary
  if (isPollsSuspensionTransition(pollsTransitionType)) {
    return undefined;
  }

  const partyIds =
    getPartyIdsForPrecinctScannerTallyReports(electionDefinition);

  if (partyIds.length <= 1) {
    return undefined;
  }

  return partyIds.map((partyId) => {
    if (!partyId) {
      return 'Nonpartisan Contests';
    }

    return getPartyById(electionDefinition, partyId).fullName;
  });
}

export function FujitsuPostPrintScreen({
  electionDefinition,
  pollsTransitionType,
  isPostPollsTransition,
  initialPrintResult,
}: {
  electionDefinition: ElectionDefinition;
  pollsTransitionType: PollsTransitionType;
  isPostPollsTransition: boolean;
  initialPrintResult: FujitsuPrintResult;
}): JSX.Element {
  // we start on index 1 because we printed the first report before transitioning to this screen
  const [printIndex, setPrintIndex] = useState(1);
  const [printResult, setPrintResult] =
    useState<Optional<FujitsuPrintResult>>(initialPrintResult);
  const printReportSectionMutation = printReportSection.useMutation();
  const printReportSectionMutateAsync = printReportSectionMutation.mutateAsync;
  const printerStatusQuery = getPrinterStatus.useQuery();
  const reportManifest = getReportManifest(
    electionDefinition,
    pollsTransitionType
  );

  function getReportSectionTitle(index: number): string {
    assert(reportManifest);
    const section = reportManifest[index];
    return `${section} ${getPollsReportTitle(pollsTransitionType)}`;
  }

  const printSection = useCallback(
    async (index: number) => {
      setPrintResult(undefined);
      const newPrintResult = await printReportSectionMutateAsync({ index });
      setPrintResult(newPrintResult);
      setPrintIndex(index + 1);
    },
    [printReportSectionMutateAsync]
  );

  assert(printerStatusQuery.isSuccess);
  const printerStatus = printerStatusQuery.data;
  assert(printerStatus.scheme === 'hardware-v4');
  const disablePrinting = printerStatus.state !== 'idle';

  if (!printResult) {
    return (
      <Screen>
        <LoadingAnimation />
        <CenteredLargeProse>
          <H1>Printing Report…</H1>
        </CenteredLargeProse>
      </Screen>
    );
  }

  const header: JSX.Element | null = isPostPollsTransition ? (
    <H1>{getPostPollsTransitionHeaderText(pollsTransitionType)}</H1>
  ) : null;

  if (printResult.isErr()) {
    const errorStatus = printResult.err();
    const reprintText = !reportManifest
      ? `Reprint ${getPollsReportTitle(pollsTransitionType)}`
      : `Reprint ${getReportSectionTitle(printIndex - 1)}`;

    return (
      <Screen>
        <CenteredLargeProse>
          <H1>Printing Stopped</H1>
          <P>
            {errorStatus.state === 'no-paper'
              ? 'The report did not finish printing because the printer ran out of paper.'
              : 'The report did not finish printing because the printer encountered an unexpected error.'}
          </P>
          <PollWorkerLoadAndReprintButton
            reprint={() => printSection(printIndex - 1)}
            reprintText={reprintText}
          />
        </CenteredLargeProse>
      </Screen>
    );
  }

  // there's only one report to print
  if (!reportManifest) {
    return (
      <Screen>
        <CenteredLargeProse>
          {header}
          <P>
            Report printed. Remove the poll worker card once you have printed
            all necessary reports.
          </P>
          <P>
            <Button onPress={() => printSection(0)} disabled={disablePrinting}>
              Reprint {getPollsReportTitle(pollsTransitionType)}
            </Button>
          </P>
        </CenteredLargeProse>
      </Screen>
    );
  }

  const reportsLeft = reportManifest.length - printIndex;

  return (
    <Screen>
      <CenteredLargeProse>
        {header}
        <P>
          Finished printing the {getReportSectionTitle(printIndex - 1)}. Remove
          the report from the printer by gently tearing it against the tear bar.
        </P>
        {reportsLeft === 0 ? (
          <React.Fragment>
            <P>
              Remove the poll worker card once you have printed all necessary
              reports.
            </P>
            <P>
              <Button
                onPress={() => printSection(printIndex - 1)}
                disabled={disablePrinting}
              >
                Reprint Previous
              </Button>{' '}
              <Button
                onPress={() => printSection(0)}
                disabled={disablePrinting}
              >
                Reprint All
              </Button>
            </P>
          </React.Fragment>
        ) : (
          <P>
            <Button
              onPress={() => printSection(printIndex - 1)}
              disabled={disablePrinting}
            >
              Reprint Previous
            </Button>{' '}
            <Button
              variant="primary"
              onPress={() => printSection(printIndex)}
              disabled={disablePrinting}
            >
              Print Next
            </Button>
          </P>
        )}
      </CenteredLargeProse>
    </Screen>
  );
}
