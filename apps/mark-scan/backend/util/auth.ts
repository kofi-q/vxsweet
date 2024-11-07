import {
  InsertedSmartCardAuth,
  type InsertedSmartCardAuthApi,
  type InsertedSmartCardAuthMachineState,
  JavaCard,
  MockFileCard,
} from '@vx/libs/auth/src';
import { BaseLogger, type LoggingUserRole } from '@vx/libs/logging/src';
import {
  BooleanEnvironmentVariableName,
  isFeatureFlagEnabled,
  isIntegrationTest,
} from '@vx/libs/utils/src';
import { DEFAULT_SYSTEM_SETTINGS } from '@vx/libs/types/elections';
import { type Workspace } from './workspace';

export function getDefaultAuth(logger: BaseLogger): InsertedSmartCardAuth {
  return new InsertedSmartCardAuth({
    card:
      isFeatureFlagEnabled(BooleanEnvironmentVariableName.USE_MOCK_CARDS) ||
      isIntegrationTest()
        ? new MockFileCard()
        : new JavaCard(),
    config: { allowCardlessVoterSessions: true },
    logger,
  });
}

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
  return authStatus.status === 'logged_in' ? authStatus.user.role : 'unknown';
}
