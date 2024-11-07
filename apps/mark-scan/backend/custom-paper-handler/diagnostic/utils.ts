import { readElection } from '@vx/libs/fs/src';
import {
  type ElectionDefinition,
  ElectionPackageFileName,
} from '@vx/libs/types/src';
import { join } from 'node:path';
import { generateMockVotes } from '@vx/libs/utils/src';
import { pdfToImages, writeImageData } from '@vx/libs/image-utils/src';
import { iter } from '@vx/libs/basics/iterators';
import { assert, assertDefined } from '@vx/libs/basics/assert';
import tmp from 'tmp';
import { Buffer } from 'node:buffer';
import { renderTestModeBallotWithoutLanguageContext } from '../../util/render_ballot';

export const DIAGNOSTIC_ELECTION_PATH = join(
  __dirname,
  ElectionPackageFileName.ELECTION
);

export function renderDiagnosticMockBallot(
  electionDefinition: ElectionDefinition
): Promise<Buffer> {
  const { election } = electionDefinition;
  return renderTestModeBallotWithoutLanguageContext(
    electionDefinition,
    election.precincts[0].id,
    election.ballotStyles[0].id,
    generateMockVotes(election)
  );
}

/**
 * This function is for testing only, such as mocking the driver scanAndSave response
 * during the scanning state of the paper handler diagnostic.
 * It renders a mock ballot for the paper handler diagnostic election as an image,
 * saves it to a tmp dir, and returns the filepath.
 */
export async function getDiagnosticMockBallotImagePath(): Promise<string> {
  const electionDefinitionResult = await readElection(DIAGNOSTIC_ELECTION_PATH);
  const electionDefinition = electionDefinitionResult.unsafeUnwrap();

  const pdfData = await renderDiagnosticMockBallot(electionDefinition);

  const first = assertDefined(
    await iter(pdfToImages(pdfData, { scale: 200 / 72 })).first()
  );
  assert(first.pageCount === 1);
  const file = tmp.fileSync({ postfix: '.jpg' });
  await writeImageData(file.name, first.page);
  return file.name;
}
