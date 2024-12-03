import 'tsx/cjs';

import { resolve } from 'node:path';
import { loadEnvVarsFromDotenvFiles } from '@vx/libs/backend/env';
import { BaseLogger } from '@vx/libs/logging/src';
import { LogSource } from '@vx/libs/logging/src/base_types';
import { WORKSPACE } from './globals/globals';
import * as server from './app/server';
import { createWorkspace } from './app/workspace';
import { GoogleCloudSpeechSynthesizer } from './language_and_audio/tts/speech_synthesizer';
import { GoogleCloudTranslator } from './language_and_audio/translation/translator';

loadEnvVarsFromDotenvFiles();

function main(): Promise<number> {
  if (!WORKSPACE) {
    throw new Error(
      'Workspace path could not be determined; pass a workspace or run with WORKSPACE'
    );
  }
  const workspacePath = resolve(WORKSPACE);
  const workspace = createWorkspace(
    workspacePath,
    new BaseLogger(LogSource.VxDesignService)
  );
  const { store } = workspace;
  const speechSynthesizer = new GoogleCloudSpeechSynthesizer({ store });
  const translator = new GoogleCloudTranslator({ store });

  server.start({ speechSynthesizer, translator, workspace });
  return Promise.resolve(0);
}

void main()
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error(`Error starting VxDesign backend: ${error.stack}`);
    return 1;
  })
  .then((code) => {
    process.exitCode = code;
  });
