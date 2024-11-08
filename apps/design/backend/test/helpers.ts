/* eslint-disable max-classes-per-file */
import path from 'node:path';
import * as tmp from 'tmp';
import { suppressingConsoleOutput } from '@vx/libs/test-utils/src';
import { assertDefined } from '@vx/libs/basics/assert';
import { type ElectionSerializationFormat } from '@vx/libs/types/elections';
import { LanguageCode } from '@vx/libs/types/languages';
import { mockBaseLogger } from '@vx/libs/logging/src';
import { buildApi, type Api } from '../app/app';
import {
  GoogleCloudSpeechSynthesizer,
  type MinimalGoogleCloudTextToSpeechClient,
} from '../language_and_audio/tts/speech_synthesizer';
import {
  GoogleCloudTranslator,
  type MinimalGoogleCloudTranslationClient,
} from '../language_and_audio/translation/translator';
import { type VendoredTranslations } from '../language_and_audio/vendored-translations/translations';
import { type Workspace, createWorkspace } from '../app/workspace';
import * as worker from '../worker/worker';

tmp.setGracefulCleanup();

export function mockCloudTranslatedText(
  englishText: string,
  languageCode: string
): string {
  return `${englishText} (in ${languageCode})`;
}

export class MockGoogleCloudTranslationClient
  implements MinimalGoogleCloudTranslationClient
{
  // eslint-disable-next-line vx/gts-no-public-class-fields
  translateText = jest.fn(
    (input: {
      contents: string[];
      targetLanguageCode: string;
    }): Promise<
      [
        { translations: Array<{ translatedText: string }> },
        undefined,
        undefined,
      ]
    > =>
      Promise.resolve([
        {
          translations: input.contents.map((text) => ({
            translatedText: mockCloudTranslatedText(
              text,
              input.targetLanguageCode
            ),
          })),
        },
        undefined,
        undefined,
      ])
  );
}

export function mockCloudSynthesizedSpeech(text: string): string {
  return `${text} (audio)`;
}

export function isMockCloudSynthesizedSpeech(audioContent: string): boolean {
  return audioContent.endsWith(' (audio)');
}

export class MockGoogleCloudTextToSpeechClient
  implements MinimalGoogleCloudTextToSpeechClient
{
  // eslint-disable-next-line vx/gts-no-public-class-fields
  synthesizeSpeech = jest.fn(
    (input: {
      input: { text: string };
    }): Promise<
      [{ audioContent: string | Uint8Array }, undefined, undefined]
    > =>
      Promise.resolve([
        { audioContent: mockCloudSynthesizedSpeech(input.input.text) },
        undefined,
        undefined,
      ])
  );
}

const vendoredTranslations: VendoredTranslations = {
  [LanguageCode.CHINESE_SIMPLIFIED]: {},
  [LanguageCode.CHINESE_TRADITIONAL]: {},
  [LanguageCode.SPANISH]: {},
};

export function newTestApi(): { api: Api; workspace: Workspace } {
  const workspace = createWorkspace(tmp.dirSync().name, mockBaseLogger());
  const { store } = workspace;
  const speechSynthesizer = new GoogleCloudSpeechSynthesizer({
    store,
    textToSpeechClient: new MockGoogleCloudTextToSpeechClient(),
  });
  const translator = new GoogleCloudTranslator({
    store,
    translationClient: new MockGoogleCloudTranslationClient(),
    vendoredTranslations,
  });
  //
  return {
    api: buildApi({ speechSynthesizer, translator, workspace }),
    workspace,
  };
}

export async function processNextBackgroundTaskIfAny(
  workspace: Workspace
): Promise<void> {
  const { store } = workspace;
  const speechSynthesizer = new GoogleCloudSpeechSynthesizer({
    store,
    textToSpeechClient: new MockGoogleCloudTextToSpeechClient(),
  });
  const translator = new GoogleCloudTranslator({
    store,
    translationClient: new MockGoogleCloudTranslationClient(),
    vendoredTranslations,
  });

  await suppressingConsoleOutput(() =>
    worker.processNextBackgroundTaskIfAny({
      speechSynthesizer,
      translator,
      workspace,
    })
  );
}

export const ELECTION_PACKAGE_FILE_NAME_REGEX =
  /election-package-([0-9a-z]{7})-([0-9a-z]{7})\.zip$/;

export async function exportElectionPackage({
  api: api,
  electionId,
  workspace,
  electionSerializationFormat,
}: {
  api: Api;
  electionId: string;
  workspace: Workspace;
  electionSerializationFormat: ElectionSerializationFormat;
}): Promise<string> {
  api.exportElectionPackage({
    electionId,
    electionSerializationFormat,
  });
  await processNextBackgroundTaskIfAny(workspace);

  const electionPackage = api.getElectionPackage({ electionId });
  const electionPackageFileName = assertDefined(
    assertDefined(electionPackage.url).match(ELECTION_PACKAGE_FILE_NAME_REGEX)
  )[0];
  const electionPackageFilePath = path.join(
    workspace.assetDirectoryPath,
    electionPackageFileName
  );

  return electionPackageFilePath;
}
