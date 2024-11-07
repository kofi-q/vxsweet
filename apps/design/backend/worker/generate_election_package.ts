import JsZip from 'jszip';
import path from 'node:path';
import {
  BallotType,
  type ElectionSerializationFormat,
  ElectionPackageFileName,
  type ElectionPackageMetadata,
  type Election,
  formatElectionHashes,
} from '@vx/libs/types/elections';
import { type Id } from '@vx/libs/types/basic';
import { mergeUiStrings } from '@vx/libs/types/ui_strings';

import {
  createPlaywrightRenderer,
  renderAllBallotsAndCreateElectionDefinition,
  vxDefaultBallotTemplate,
} from '@vx/libs/hmpb/src';
import { sha256 } from 'js-sha256';
import { writeFile } from 'node:fs/promises';
import { PORT } from '../globals/globals';
import { extractAndTranslateElectionStrings } from '../language_and_audio/strings/election_strings';
import { generateAudioIdsAndClips } from '../language_and_audio/audio/audio';
import { translateAppStrings } from '../language_and_audio/strings/app_strings';
import { type WorkerContext } from './context';
import { translateHmpbStrings } from '../language_and_audio/strings/ballot_strings';

export async function generateElectionPackage(
  { speechSynthesizer, translator, workspace }: WorkerContext,
  {
    electionId,
    electionSerializationFormat,
  }: {
    electionId: Id;
    electionSerializationFormat: ElectionSerializationFormat;
  }
): Promise<void> {
  const { assetDirectoryPath, store } = workspace;

  const { ballotLanguageConfigs, election, systemSettings } =
    store.getElection(electionId);

  const zip = new JsZip();

  const metadata: ElectionPackageMetadata = {
    version: 'latest',
  };
  zip.file(ElectionPackageFileName.METADATA, JSON.stringify(metadata, null, 2));

  const appStrings = await translateAppStrings(
    translator,
    metadata.version,
    ballotLanguageConfigs
  );
  zip.file(
    ElectionPackageFileName.APP_STRINGS,
    JSON.stringify(appStrings, null, 2)
  );

  const hmpbStrings = await translateHmpbStrings(
    translator,
    ballotLanguageConfigs
  );
  const electionStrings = await extractAndTranslateElectionStrings(
    translator,
    election,
    ballotLanguageConfigs
  );
  const ballotStrings = mergeUiStrings(electionStrings, hmpbStrings);

  const electionWithBallotStrings: Election = {
    ...election,
    ballotStrings,
  };

  const renderer = await createPlaywrightRenderer();
  const { electionDefinition } =
    await renderAllBallotsAndCreateElectionDefinition(
      renderer,
      vxDefaultBallotTemplate,
      // Each ballot style will have exactly one grid layout regardless of precinct, ballot type, or ballot mode
      // So we just need to render a single ballot per ballot style to create the election definition
      election.ballotStyles.map((ballotStyle) => ({
        election: electionWithBallotStrings,
        ballotStyleId: ballotStyle.id,
        precinctId: ballotStyle.precincts[0],
        ballotType: BallotType.Precinct,
        ballotMode: 'test',
      })),
      electionSerializationFormat
    );
  zip.file(ElectionPackageFileName.ELECTION, electionDefinition.electionData);
  // eslint-disable-next-line no-console
  renderer.cleanup().catch(console.error);

  zip.file(
    ElectionPackageFileName.SYSTEM_SETTINGS,
    JSON.stringify(systemSettings, null, 2)
  );

  const { uiStringAudioIds, uiStringAudioClips } = generateAudioIdsAndClips({
    appStrings,
    electionStrings,
    speechSynthesizer,
  });
  zip.file(
    ElectionPackageFileName.AUDIO_IDS,
    JSON.stringify(uiStringAudioIds, null, 2)
  );
  zip.file(ElectionPackageFileName.AUDIO_CLIPS, uiStringAudioClips);

  const zipContents = await zip.generateAsync({
    type: 'nodebuffer',
    streamFiles: true,
  });
  const electionPackageHash = sha256(zipContents);
  const combinedHash = formatElectionHashes(
    electionDefinition.ballotHash,
    electionPackageHash
  );
  const fileName = `election-package-${combinedHash}.zip`;
  const filePath = path.join(assetDirectoryPath, fileName);
  await writeFile(filePath, zipContents);
  store.setElectionPackageUrl({
    electionId,
    electionPackageUrl: `http://localhost:${PORT}/${fileName}`,
  });
}
