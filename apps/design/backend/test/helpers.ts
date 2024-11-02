/* eslint-disable max-classes-per-file */
import { Server } from 'node:http';
import { AddressInfo } from 'node:net';
import path from 'node:path';
import * as tmp from 'tmp';
import * as grout from '@vx/libs/grout/src';
import { suppressingConsoleOutput } from '@vx/libs/test-utils/src';
import { assertDefined } from '@vx/libs/basics/src';
import {
  type ElectionSerializationFormat,
  LanguageCode,
} from '@vx/libs/types/src';
import { mockBaseLogger } from '@vx/libs/logging/src';
import { buildApp, type Api } from '../src/app';
import {
  GoogleCloudSpeechSynthesizer,
  type MinimalGoogleCloudTextToSpeechClient,
} from '../src/language_and_audio/speech_synthesizer';
import {
  GoogleCloudTranslator,
  type MinimalGoogleCloudTranslationClient,
} from '../src/language_and_audio/translator';
import { type VendoredTranslations } from '../src/language_and_audio/vendored_translations';
import { type Workspace, createWorkspace } from '../src/workspace';
import * as worker from '../src/worker/worker';

tmp.setGracefulCleanup();

export type ApiClient = grout.Client<Api>;

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

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function testSetupHelpers() {
  const servers: Server[] = [];

  function setupApp() {
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
    const app = buildApp({ speechSynthesizer, translator, workspace });
    const server = app.listen();
    servers.push(server);
    const { port } = server.address() as AddressInfo;
    const baseUrl = `http://localhost:${port}/api`;
    const apiClient = grout.createClient<Api>({ baseUrl });
    return { apiClient, workspace };
  }

  function cleanup() {
    for (const server of servers) {
      server.close();
    }
  }

  return {
    setupApp,
    cleanup,
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
  apiClient,
  electionId,
  workspace,
  electionSerializationFormat,
}: {
  apiClient: ApiClient;
  electionId: string;
  workspace: Workspace;
  electionSerializationFormat: ElectionSerializationFormat;
}): Promise<string> {
  await apiClient.exportElectionPackage({
    electionId,
    electionSerializationFormat,
  });
  await processNextBackgroundTaskIfAny(workspace);

  const electionPackage = await apiClient.getElectionPackage({
    electionId,
  });
  const electionPackageFileName = assertDefined(
    assertDefined(electionPackage.url).match(ELECTION_PACKAGE_FILE_NAME_REGEX)
  )[0];
  const electionPackageFilePath = path.join(
    workspace.assetDirectoryPath,
    electionPackageFileName
  );

  return electionPackageFilePath;
}
