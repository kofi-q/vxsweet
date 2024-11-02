import { z } from 'zod';
import { throwIllegalValue } from '@vx/libs/basics/src';
import {
  ElectionSerializationFormatSchema,
  safeParseJson,
} from '@vx/libs/types/src';

import { type BackgroundTask } from '../store/store';
import { type WorkerContext } from './context';
import { generateElectionPackage } from './generate_election_package';

export async function processBackgroundTask(
  context: WorkerContext,
  { taskName, payload }: BackgroundTask
): Promise<void> {
  switch (taskName) {
    case 'generate_election_package': {
      const parsedPayload = safeParseJson(
        payload,
        z.object({
          electionId: z.string(),
          electionSerializationFormat: ElectionSerializationFormatSchema,
        })
      ).unsafeUnwrap();
      await generateElectionPackage(context, parsedPayload);
      break;
    }
    /* istanbul ignore next: Compile-time check for completeness */
    default: {
      throwIllegalValue(taskName);
    }
  }
}
