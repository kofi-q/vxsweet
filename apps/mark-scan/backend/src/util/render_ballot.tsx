import {
  PAPER_DIMENSIONS,
  PaperDimensions,
  renderToPdf,
} from '@vx/libs/printing/src';
import {
  BallotStyleId,
  ElectionDefinition,
  LanguageCode,
  VotesDict,
} from '@vx/libs/types/src';
import { Buffer } from 'node:buffer';

import { assertDefined } from '@vx/libs/basics/src';
import {
  BmdPaperBallot,
  BackendLanguageContextProvider,
  BmdBallotSheetSize,
} from '@vx/libs/ui/src';
import { randomBallotId } from '@vx/libs/utils/src';
import { Store } from '../store';
import { getMarkScanBmdModel } from './hardware';

export interface RenderBallotProps {
  store: Store;
  precinctId: string;
  ballotStyleId: BallotStyleId;
  votes: VotesDict;
  languageCode: LanguageCode;
}

function getPaperDimensions(): PaperDimensions {
  /* istanbul ignore next - hardware support in flux */
  return getMarkScanBmdModel() === 'bmd-150'
    ? PAPER_DIMENSIONS['Bmd150']
    : PAPER_DIMENSIONS['Letter'];
}

function getSheetSize(): BmdBallotSheetSize {
  /* istanbul ignore next - hardware support in flux */
  return getMarkScanBmdModel() === 'bmd-150' ? 'bmd150' : 'letter';
}

export async function renderTestModeBallotWithoutLanguageContext(
  electionDefinition: ElectionDefinition,
  precinctId: string,
  ballotStyleId: BallotStyleId,
  votes: VotesDict
): Promise<Buffer> {
  const ballot = (
    <BmdPaperBallot
      binarize
      electionDefinition={electionDefinition}
      ballotStyleId={ballotStyleId}
      precinctId={precinctId}
      votes={votes}
      isLiveMode={false}
      generateBallotId={randomBallotId}
      machineType="markScan"
      sheetSize={getSheetSize()}
    />
  );

  return (
    await renderToPdf({
      document: ballot,
      paperDimensions: getPaperDimensions(),
    })
  ).unsafeUnwrap();
}

export async function renderBallot({
  store,
  precinctId,
  ballotStyleId,
  votes,
  languageCode,
}: RenderBallotProps): Promise<Buffer> {
  const { electionDefinition } = assertDefined(store.getElectionRecord());
  const isLiveMode = !store.getTestMode();

  const ballot = (
    <BackendLanguageContextProvider
      currentLanguageCode={languageCode}
      uiStringsPackage={store.getUiStringsStore().getAllUiStrings()}
    >
      <BmdPaperBallot
        binarize
        electionDefinition={electionDefinition}
        ballotStyleId={ballotStyleId}
        precinctId={precinctId}
        votes={votes}
        isLiveMode={isLiveMode}
        generateBallotId={randomBallotId}
        machineType="markScan"
        sheetSize={getSheetSize()}
      />
    </BackendLanguageContextProvider>
  );

  return (
    await renderToPdf({
      document: ballot,
      paperDimensions: getPaperDimensions(),
    })
  ).unsafeUnwrap();
}
