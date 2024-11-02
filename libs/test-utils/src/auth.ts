import { DateTime } from 'luxon';
import { type BallotStyleId, type ElectionId } from '@vx/libs/types/src';
import {
  type CardlessVoterUser,
  DEFAULT_OVERALL_SESSION_TIME_LIMIT_HOURS,
  type ElectionManagerUser,
  type PollWorkerUser,
  type SystemAdministratorUser,
  TEST_JURISDICTION,
  type VendorUser,
} from '@vx/libs/types/src/auth';
import { DateWithoutTime } from '@vx/libs/basics/src';

export function mockVendorUser(props: Partial<VendorUser> = {}): VendorUser {
  return {
    role: 'vendor',
    jurisdiction: TEST_JURISDICTION,
    ...props,
  };
}

export function mockSystemAdministratorUser(
  props: Partial<SystemAdministratorUser> = {}
): SystemAdministratorUser {
  return {
    role: 'system_administrator',
    jurisdiction: TEST_JURISDICTION,
    ...props,
  };
}

export function mockElectionManagerUser(
  props: Partial<ElectionManagerUser> = {}
): ElectionManagerUser {
  return {
    role: 'election_manager',
    jurisdiction: TEST_JURISDICTION,
    electionKey: {
      id: 'election-id' as ElectionId,
      date: new DateWithoutTime('2024-07-10'),
    },
    ...props,
  };
}

export function mockPollWorkerUser(
  props: Partial<PollWorkerUser> = {}
): PollWorkerUser {
  return {
    role: 'poll_worker',
    jurisdiction: TEST_JURISDICTION,
    electionKey: {
      id: 'election-id' as ElectionId,
      date: new DateWithoutTime('2024-07-10'),
    },
    ...props,
  };
}

export function mockCardlessVoterUser(
  props: Partial<CardlessVoterUser> = {}
): CardlessVoterUser {
  return {
    role: 'cardless_voter',
    ballotStyleId: 'ballot-style-id' as BallotStyleId,
    precinctId: 'precinct-id',
    sessionId: 'session-id',
    ...props,
  };
}

export function mockSessionExpiresAt(): Date {
  return DateTime.now()
    .plus({ hours: DEFAULT_OVERALL_SESSION_TIME_LIMIT_HOURS })
    .toJSDate();
}
