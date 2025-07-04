import { type Election, TEST_JURISDICTION } from '@vx/libs/types/elections';

import { mockCard } from '../mock-cards/mock_file_card';

/**
 * The default PIN used in integration tests
 */
export const INTEGRATION_TEST_DEFAULT_PIN = '000000';

/**
 * Mocks system administrator card insertion
 */
export function mockSystemAdministratorCardInsertion(): void {
  mockCard({
    cardStatus: {
      status: 'ready',
      cardDetails: {
        user: {
          role: 'system_administrator',
          jurisdiction: TEST_JURISDICTION,
        },
      },
    },
    pin: INTEGRATION_TEST_DEFAULT_PIN,
  });
}

/**
 * Mocks election manager card insertion
 */
export function mockElectionManagerCardInsertion({
  election,
}: {
  election: Election;
}): void {
  mockCard({
    cardStatus: {
      status: 'ready',
      cardDetails: {
        user: {
          role: 'election_manager',
          jurisdiction: TEST_JURISDICTION,
          electionKey: {
            id: election.id,
            date: election.date,
          },
        },
      },
    },
    pin: INTEGRATION_TEST_DEFAULT_PIN,
  });
}

/**
 * Mocks poll worker card insertion
 */
export function mockPollWorkerCardInsertion({
  election,
}: {
  election: Election;
}): void {
  mockCard({
    cardStatus: {
      status: 'ready',
      cardDetails: {
        user: {
          role: 'poll_worker',
          jurisdiction: TEST_JURISDICTION,
          electionKey: {
            id: election.id,
            date: election.date,
          },
        },
        hasPin: false,
      },
    },
  });
}

/**
 * Mocks card removal
 */
export function mockCardRemoval(): void {
  mockCard({
    cardStatus: {
      status: 'no_card',
    },
  });
}
