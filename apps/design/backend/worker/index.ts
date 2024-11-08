import path from 'node:path';
import { loadEnvVarsFromDotenvFiles } from '@vx/libs/backend/env';
import { assertDefined } from '@vx/libs/basics/assert';

import { BaseLogger } from '@vx/libs/logging/src';
import { LogSource } from '@vx/libs/logging/src/base_types';
import { WORKSPACE } from '../globals/globals';
import { GoogleCloudSpeechSynthesizer } from '../language_and_audio/tts/speech_synthesizer';
import { GoogleCloudTranslator } from '../language_and_audio/translation/translator';
import { createWorkspace } from '../app/workspace';
import * as worker from './worker';

loadEnvVarsFromDotenvFiles();

async function main(): Promise<void> {
  const workspacePath = path.resolve(assertDefined(WORKSPACE));
  const workspace = createWorkspace(
    workspacePath,
    new BaseLogger(LogSource.VxDesignWorker)
  );
  const { store } = workspace;
  const speechSynthesizer = new GoogleCloudSpeechSynthesizer({ store });
  const translator = new GoogleCloudTranslator({ store });

  worker.start({ speechSynthesizer, translator, workspace });
  return Promise.resolve();
}

if (require.main === module) {
  main()
    .then(() => {
      process.stdout.write('VxDesign background worker running\n');
      process.exitCode = 0;
    })
    .catch((error) => {
      process.stderr.write(
        `Error starting VxDesign background worker:\n${error.stack}\n`
      );
      process.exitCode = 1;
    });
}
