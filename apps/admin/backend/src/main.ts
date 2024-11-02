// Import the rest of our application.
import { BaseLogger, LogEventId } from '@vx/libs/logging/src';
import { LogSource } from '@vx/libs/logging/src/base_types';
import {
  handleUncaughtExceptions,
  loadEnvVarsFromDotenvFiles,
} from '@vx/libs/backend/src';
import * as server from './server';

loadEnvVarsFromDotenvFiles();

const logger = new BaseLogger(LogSource.VxAdminService);

async function main(): Promise<number> {
  handleUncaughtExceptions(logger);

  await server.start({});
  return 0;
}

void main()
  .catch((error) => {
    void logger.log(LogEventId.ApplicationStartup, 'system', {
      message: `Error in starting Admin Service: ${error.stack}`,
      disposition: 'failure',
    });
    return 1;
  })
  .then((code) => {
    process.exitCode = code;
  });
