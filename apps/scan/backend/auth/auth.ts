import {
  type InsertedSmartCardAuthApi,
  type InsertedSmartCardAuthMachineState,
} from '@vx/libs/auth/src';
import { DEFAULT_SYSTEM_SETTINGS } from '@vx/libs/types/src';
import { type LoggingUserRole } from '@vx/libs/logging/src';
import { Store } from '../store/store';
import { type Workspace } from '../workspace/workspace';

export function constructAuthMachineState(
  store: Store
): InsertedSmartCardAuthMachineState {
  const electionKey = store.getElectionKey();
  const jurisdiction = store.getJurisdiction();
  const systemSettings = store.getSystemSettings() ?? DEFAULT_SYSTEM_SETTINGS;
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
    constructAuthMachineState(workspace.store)
  );
  if (authStatus.status === 'logged_in') {
    return authStatus.user.role;
  }
  return 'unknown';
}
