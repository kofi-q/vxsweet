import { resolve } from 'node:path';
import { loadEnvVarsFromDotenvFiles } from '@vx/libs/backend/src';
import { BaseLogger, LogSource } from '@vx/libs/logging/src';
import { WORKSPACE } from './globals';
import * as server from './server';
import { createWorkspace } from './workspace';
import {
  GoogleCloudSpeechSynthesizer,
  GoogleCloudTranslator,
} from './language_and_audio';

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
