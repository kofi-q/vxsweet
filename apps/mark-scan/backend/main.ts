import { BaseLogger, LogEventId } from '@vx/libs/logging/src';
import { LogSource } from '@vx/libs/logging/src/base_types';
import { handleUncaughtExceptions } from '@vx/libs/backend/exceptions';
import { loadEnvVarsFromDotenvFiles } from '@vx/libs/backend/env';
import * as server from './server/server';
import { MARK_SCAN_WORKSPACE, PORT } from './globals/globals';
import { createWorkspace, type Workspace } from './util/workspace';

loadEnvVarsFromDotenvFiles();

const logger = new BaseLogger(LogSource.VxMarkScanBackend);

async function resolveWorkspace(): Promise<Workspace> {
  const workspacePath = MARK_SCAN_WORKSPACE;
  if (!workspacePath) {
    await logger.log(LogEventId.WorkspaceConfigurationMessage, 'system', {
      message:
        'workspace path could not be determined; pass a workspace or run with MARK_SCAN_WORKSPACE',
      disposition: 'failure',
    });
    throw new Error(
      'workspace path could not be determined; pass a workspace or run with MARK_SCAN_WORKSPACE'
    );
  }
  return createWorkspace(workspacePath, logger);
}

async function main(): Promise<number> {
  handleUncaughtExceptions(logger);

  const workspace = await resolveWorkspace();
  await server.start({ port: PORT, logger, workspace });
  return 0;
}

void main()
  .catch((error) => {
    void logger.log(LogEventId.ApplicationStartup, 'system', {
      message: `Error in starting VxMarkScan backend: ${
        (error as Error).stack
      }`,
      disposition: 'failure',
    });
    return 1;
  })
  .then((code) => {
    process.exitCode = code;
  });
