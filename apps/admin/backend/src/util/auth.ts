import {
  DEV_JURISDICTION,
  DippedSmartCardAuthApi,
  DippedSmartCardAuthMachineState,
} from '@vx/libs/auth/src';
import { isIntegrationTest } from '@vx/libs/utils/src';
import { DEFAULT_SYSTEM_SETTINGS, TEST_JURISDICTION } from '@vx/libs/types/src';
import { LoggingUserRole } from '@vx/libs/logging/src';
import { Workspace } from './workspace';

/**
 * Construct the auth state machine based on the election state in the store.
 */
export function constructAuthMachineState(
  workspace: Workspace
): DippedSmartCardAuthMachineState {
  const electionId = workspace.store.getCurrentElectionId();

  /* istanbul ignore next - covered by integration testing */
  const jurisdiction = isIntegrationTest()
    ? TEST_JURISDICTION
    : process.env.VX_MACHINE_JURISDICTION ?? DEV_JURISDICTION;

  if (!electionId) {
    return {
      ...DEFAULT_SYSTEM_SETTINGS.auth,
      jurisdiction,
    };
  }

  const systemSettings = workspace.store.getSystemSettings(electionId);
  return {
    ...systemSettings.auth,
    electionKey: workspace.store.getElectionKey(electionId),
    jurisdiction,
  };
}

/**
 * Get the current logging user role.
 */
export async function getUserRole(
  auth: DippedSmartCardAuthApi,
  workspace: Workspace
): Promise<LoggingUserRole> {
  const authStatus = await auth.getAuthStatus(
    constructAuthMachineState(workspace)
  );
  if (authStatus.status === 'logged_in') {
    return authStatus.user.role;
  }
  /* istanbul ignore next - trivial fallback case */
  return 'unknown';
}
