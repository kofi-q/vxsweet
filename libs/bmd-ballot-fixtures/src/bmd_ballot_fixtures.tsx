import React from 'react';
import { renderToPdf } from '@vx/libs/printing/src';
import tmp from 'tmp';
import {
  type ElectionDefinition,
  type VotesDict,
  type BallotStyleId,
  type PrecinctId,
  vote,
} from '@vx/libs/types/elections';
import { BmdPaperBallot, type BmdPaperBallotProps } from '@vx/libs/ui/ballots';
import { Buffer } from 'node:buffer';
import { election as electionGeneral } from '@vx/libs/fixtures/src/data/electionGeneral/election.json';
import { election as electionFamousNames } from '@vx/libs/fixtures/src/data/electionFamousNames2021/election.json';
import { assertDefined } from '@vx/libs/basics/assert';
import { iter } from '@vx/libs/basics/iterators';
import { pdfToImages, writeImageData } from '@vx/libs/image-utils/src';

export async function renderBmdBallotFixture(
  props: Partial<BmdPaperBallotProps> & {
    electionDefinition: ElectionDefinition;
    rotateImage?: boolean;
    frontPageOnly?: boolean;
  }
): Promise<Buffer> {
  // Set some default props that can be overridden by the caller
  const {
    electionDefinition: { election },
    rotateImage = false,
    frontPageOnly = false,
  } = props;
  const ballotStyle = election.ballotStyles[0];
  const precinctId = ballotStyle.precincts[0];
  const votes: VotesDict = {};
  const ballot = (
    <React.Fragment>
      <BmdPaperBallot
        isLiveMode={false}
        generateBallotId={() => '1'}
        machineType="mark"
        ballotStyleId={ballotStyle.id}
        precinctId={precinctId}
        votes={votes}
        {...props}
      />
      {!frontPageOnly && <div style={{ pageBreakAfter: 'always' }} />}
    </React.Fragment>
  );
  const document = rotateImage ? (
    <div style={{ transform: 'rotate(180deg)' }}>{ballot}</div>
  ) : (
    ballot
  );
  return (await renderToPdf({ document })).unsafeUnwrap();
}

// Writes the first page of `pdfData` to an image file and returns the filepath.
// BMD ballots print on one side only. Consider libs/image-utils' `BLANK_PAGE_IMAGE_DATA`
// for mocking the blank back in testing.
export async function writeFirstBallotPageToImageFile(
  pdfData: Buffer
): Promise<string> {
  const first = assertDefined(
    await iter(pdfToImages(pdfData, { scale: 200 / 72 })).first()
  );
  const file = tmp.fileSync({ postfix: '.png' });
  await writeImageData(file.name, first.page);
  return file.name;
}

export const DEFAULT_FAMOUS_NAMES_BALLOT_STYLE_ID = '1' as BallotStyleId;
export const DEFAULT_FAMOUS_NAMES_PRECINCT_ID: PrecinctId = '23';

export const DEFAULT_FAMOUS_NAMES_VOTES = vote(electionFamousNames.contests, {
  mayor: 'sherlock-holmes',
  controller: 'winston-churchill',
  attorney: 'john-snow',
  'public-works-director': 'benjamin-franklin',
  'chief-of-police': 'natalie-portman',
  'parks-and-recreation-director': 'charles-darwin',
  'board-of-alderman': [
    'helen-keller',
    'steve-jobs',
    'nikola-tesla',
    'vincent-van-gogh',
  ],
  'city-council': ['marie-curie', 'indiana-jones', 'mona-lisa', 'jackie-chan'],
});

export const DEFAULT_ELECTION_GENERAL_BALLOT_STYLE_ID =
  electionGeneral.ballotStyles[0].id;
export const DEFAULT_ELECTION_GENERAL_PRECINCT_ID: PrecinctId =
  electionGeneral.precincts[0].id;

export const DEFAULT_ELECTION_GENERAL_VOTES = vote(electionGeneral.contests, {
  president: ['barchi-hallaren'],
  senator: ['weiford'],
  'representative-district-6': ['plunkard'],
  governor: ['franz'],
  'lieutenant-governor': ['norberg'],
  'secretary-of-state': ['shamsi'],
  'state-senator-district-31': ['shiplett'],
  'state-assembly-district-54': ['solis'],
  'county-commissioners': [
    'argent',
    'witherspoonsmithson',
    'bainbridge',
    'hennessey',
  ],
  'county-registrar-of-wills': ['ramachandrani'],
  'city-mayor': ['white'],
  'city-council': ['eagle', 'rupp', 'shry'],
  'judicial-robert-demergue': ['judicial-robert-demergue-option-yes'],
  'judicial-elmer-hull': ['judicial-elmer-hull-option-yes'],
  'question-a': ['question-a-option-yes'],
  'question-b': ['question-b-option-yes'],
  'question-c': ['question-c-option-yes'],
  'proposition-1': ['proposition-1-option-yes'],
  'measure-101': ['measure-101-option-yes'],
  '102': ['measure-102-option-yes'],
});
