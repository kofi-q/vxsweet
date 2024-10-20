import { BaseLogger, LogSource, LogEventId } from '@vx/libs/logging/src';
import {
  handleUncaughtExceptions,
  loadEnvVarsFromDotenvFiles,
} from '@vx/libs/backend/src';
import * as server from './server';
import { MARK_WORKSPACE, PORT } from './globals';
import { createWorkspace, Workspace } from './util/workspace';

loadEnvVarsFromDotenvFiles();

const baseLogger = new BaseLogger(LogSource.VxMarkBackend);

async function resolveWorkspace(): Promise<Workspace> {
  const workspacePath = MARK_WORKSPACE;
  if (!workspacePath) {
    await baseLogger.log(LogEventId.WorkspaceConfigurationMessage, 'system', {
      message:
        'workspace path could not be determined; pass a workspace or run with MARK_WORKSPACE',
      disposition: 'failure',
    });
    throw new Error(
      'workspace path could not be determined; pass a workspace or run with MARK_WORKSPACE'
    );
  }
  return createWorkspace(workspacePath, baseLogger);
}

async function main(): Promise<number> {
  handleUncaughtExceptions(baseLogger);

  const workspace = await resolveWorkspace();
  await server.start({ port: PORT, baseLogger, workspace });
  return 0;
}

void main()
  .catch((error) => {
    void baseLogger.log(LogEventId.ApplicationStartup, 'system', {
      message: `Error in starting VxMark backend: ${(error as Error).stack}`,
      disposition: 'failure',
    });
    return 1;
  })
  .then((code) => {
    process.exitCode = code;
  });
