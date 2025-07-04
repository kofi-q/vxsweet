import { type DippedSmartCardAuthApi } from '@vx/libs/auth/dipped-cards';
import { mockSessionExpiresAt } from '@vx/libs/test-utils/src';
import {
  constructElectionKey,
  TEST_JURISDICTION,
  type ElectionDefinition,
} from '@vx/libs/types/elections';

export function mockElectionManagerAuth(
  auth: jest.Mocked<DippedSmartCardAuthApi>,
  electionDefinition: ElectionDefinition,
  jurisdiction = TEST_JURISDICTION
): void {
  auth.getAuthStatus.mockResolvedValue({
    status: 'logged_in',
    user: {
      role: 'election_manager',
      jurisdiction,
      electionKey: constructElectionKey(electionDefinition.election),
    },
    sessionExpiresAt: mockSessionExpiresAt(),
  });
}

export function mockSystemAdministratorAuth(
  auth: jest.Mocked<DippedSmartCardAuthApi>,
  jurisdiction = TEST_JURISDICTION
): void {
  auth.getAuthStatus.mockResolvedValue({
    status: 'logged_in',
    user: {
      role: 'system_administrator',
      jurisdiction,
    },
    sessionExpiresAt: mockSessionExpiresAt(),
    programmableCard: { status: 'no_card' },
  });
}
