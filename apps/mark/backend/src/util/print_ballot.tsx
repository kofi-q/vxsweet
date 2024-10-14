import { PrintSides, Printer, renderToPdf } from '@vx/libs/printing/src';
import { BallotStyleId, LanguageCode, VotesDict } from '@vx/libs/types/src';

import { assertDefined } from '@vx/libs/basics/src';
import {
  BmdPaperBallot,
  BackendLanguageContextProvider,
} from '@vx/libs/ui/src';
import { randomBallotId } from '@vx/libs/utils/src';
import { Store } from '../store';

export interface PrintBallotProps {
  printer: Printer;
  store: Store;
  precinctId: string;
  ballotStyleId: BallotStyleId;
  votes: VotesDict;
  languageCode: LanguageCode;
}

export async function printBallot({
  printer,
  store,
  precinctId,
  ballotStyleId,
  votes,
  languageCode,
}: PrintBallotProps): Promise<void> {
  const { electionDefinition } = assertDefined(store.getElectionRecord());
  const isLiveMode = !store.getTestMode();

  const ballot = (
    <BackendLanguageContextProvider
      currentLanguageCode={languageCode}
      uiStringsPackage={store.getUiStringsStore().getAllUiStrings()}
    >
      <BmdPaperBallot
        electionDefinition={electionDefinition}
        ballotStyleId={ballotStyleId}
        precinctId={precinctId}
        votes={votes}
        isLiveMode={isLiveMode}
        generateBallotId={randomBallotId}
        machineType="mark"
      />
    </BackendLanguageContextProvider>
  );

  return printer.print({
    data: (await renderToPdf({ document: ballot })).unsafeUnwrap(),
    sides: PrintSides.OneSided,
  });
}
