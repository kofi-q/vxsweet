import { PrintSides, type Printer } from '@vx/libs/printing/src/printer';
import { renderToPdf } from '@vx/libs/printing/src';
import { type BallotStyleId, type VotesDict } from '@vx/libs/types/elections';

import { assertDefined } from '@vx/libs/basics/assert';
import { BmdPaperBallot } from '@vx/libs/ui/ballots';
import { BackendLanguageContextProvider } from '@vx/libs/ui/ui_strings/language_context';
import { randomBallotId } from '@vx/libs/utils/src';
import { Store } from '../store/store';

export interface PrintBallotProps {
  printer: Printer;
  store: Store;
  precinctId: string;
  ballotStyleId: BallotStyleId;
  votes: VotesDict;
  languageCode: string;
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
