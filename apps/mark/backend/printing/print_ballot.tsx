import { PrintSides, type Printer } from '@vx/libs/printing/src/printer';
import { renderToPdf } from '@vx/libs/printing/src';
import {
  type BallotStyleId,
  type VotesDict,
  LanguageCode,
} from '@vx/libs/types/src';

import { assertDefined } from '@vx/libs/basics/src';
import { BmdPaperBallot } from '@vx/libs/ui/src';
import { BackendLanguageContextProvider } from '@vx/libs/ui/src/ui_strings';
import { randomBallotId } from '@vx/libs/utils/src';
import { Store } from '../store/store';

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
