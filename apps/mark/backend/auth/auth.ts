import {
  type InsertedSmartCardAuthApi,
  type InsertedSmartCardAuthMachineState,
} from '@vx/libs/auth/inserted-cards';
import { DEFAULT_SYSTEM_SETTINGS } from '@vx/libs/types/elections';
import { type LoggingUserRole } from '@vx/libs/logging/src';
import { type Workspace } from '../workspace/workspace';

export function constructAuthMachineState(
  workspace: Workspace
): InsertedSmartCardAuthMachineState {
  const electionKey = workspace.store.getElectionKey();
  const jurisdiction = workspace.store.getJurisdiction();
  const systemSettings =
    workspace.store.getSystemSettings() ?? DEFAULT_SYSTEM_SETTINGS;
  return {
    ...systemSettings.auth,
    electionKey,
    jurisdiction,
  };
}

export async function getUserRole(
  auth: InsertedSmartCardAuthApi,
  workspace: Workspace
): Promise<LoggingUserRole> {
  const authStatus = await auth.getAuthStatus(
    constructAuthMachineState(workspace)
  );
  return authStatus.status === 'logged_in'
    ? authStatus.user.role
    : /* istanbul ignore next */ 'unknown';
}
