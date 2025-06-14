jest.mock('@vx/libs/utils/src', (): typeof import('@vx/libs/utils/src') => ({
  ...jest.requireActual('@vx/libs/utils/src'),
  generatePin: jest.fn(),
  isFeatureFlagEnabled: (flag) => mockFeatureFlagger.isEnabled(flag),
}));

import { Buffer } from 'node:buffer';
import { DateTime } from 'luxon';
import { assert } from '@vx/libs/basics/assert';
import { err, ok } from '@vx/libs/basics/result';
import * as electionGeneral from '@vx/libs/fixtures/src/data/electionGeneral/election.json';
import { election as electionTwoPartyPrimary } from '@vx/libs/fixtures/src/data/electionTwoPartyPrimary/election.json';
import {
  mockBaseLogger,
  LogDispositionStandardTypes,
  LogEventId,
  BaseLogger,
} from '@vx/libs/logging/src';
import {
  mockCardlessVoterUser,
  mockElectionManagerUser,
  mockPollWorkerUser,
  mockSystemAdministratorUser,
  mockOf,
  mockVendorUser,
} from '@vx/libs/test-utils/src';
import {
  DEFAULT_NUM_INCORRECT_PIN_ATTEMPTS_ALLOWED_BEFORE_CARD_LOCKOUT,
  DEFAULT_OVERALL_SESSION_TIME_LIMIT_HOURS,
  DEFAULT_STARTING_CARD_LOCKOUT_DURATION_SECONDS,
  constructElectionKey,
  TEST_JURISDICTION,
  type BallotStyleId,
  InsertedSmartCardAuth as InsertedSmartCardAuthTypes,
} from '@vx/libs/types/elections';
import {
  BooleanEnvironmentVariableName,
  generatePin,
  getFeatureFlagMock,
} from '@vx/libs/utils/src';

import {
  buildMockCard,
  type MockCard,
  mockCardAssertComplete,
} from '../test/utils';
import { type CardDetails, type CardStatus } from '../cards/card';
import { type DippedSmartCardAuthMachineState } from '../dipped-cards/dipped_smart_card_auth_api';
import { InsertedSmartCardAuth } from './inserted_smart_card_auth';
import {
  type InsertedSmartCardAuthConfig,
  type InsertedSmartCardAuthMachineState,
} from './inserted_smart_card_auth_api';

const mockFeatureFlagger = getFeatureFlagMock();

const pin = '123456';
const wrongPin = '654321';

let mockCard: MockCard;
let mockLogger: BaseLogger;
let mockTime: DateTime;

beforeEach(() => {
  mockTime = DateTime.now();
  jest.useFakeTimers();
  jest.setSystemTime(mockTime.toJSDate());

  mockOf(generatePin).mockImplementation(() => pin);
  mockFeatureFlagger.resetFeatureFlags();

  mockCard = buildMockCard();
  mockLogger = mockBaseLogger();
});

afterEach(() => {
  mockCardAssertComplete(mockCard);
});

const jurisdiction = TEST_JURISDICTION;
const otherJurisdiction = `${TEST_JURISDICTION}-2`;
const { election, electionData } = electionGeneral.toElectionDefinition();
const electionKey = constructElectionKey(election);
const otherElectionKey = constructElectionKey(electionTwoPartyPrimary);
const defaultConfig: InsertedSmartCardAuthConfig = {};
const defaultMachineState: InsertedSmartCardAuthMachineState = {
  electionKey,
  jurisdiction,
  arePollWorkerCardPinsEnabled: false,
  numIncorrectPinAttemptsAllowedBeforeCardLockout:
    DEFAULT_NUM_INCORRECT_PIN_ATTEMPTS_ALLOWED_BEFORE_CARD_LOCKOUT,
  startingCardLockoutDurationSeconds:
    DEFAULT_STARTING_CARD_LOCKOUT_DURATION_SECONDS,
  overallSessionTimeLimitHours: DEFAULT_OVERALL_SESSION_TIME_LIMIT_HOURS,
};
const vendorUser = mockVendorUser({ jurisdiction });
const systemAdministratorUser = mockSystemAdministratorUser({ jurisdiction });
const electionManagerUser = mockElectionManagerUser({
  jurisdiction,
  electionKey,
});
const pollWorkerUser = mockPollWorkerUser({ jurisdiction, electionKey });
const cardlessVoterUser = mockCardlessVoterUser();

function mockCardStatus(cardStatus: CardStatus) {
  mockCard.getCardStatus.expectRepeatedCallsWith().resolves(cardStatus);
}

async function logInAsElectionManager(
  auth: InsertedSmartCardAuth,
  machineState: InsertedSmartCardAuthMachineState = defaultMachineState
) {
  mockCardStatus({
    status: 'ready',
    cardDetails: {
      user: electionManagerUser,
    },
  });
  expect(await auth.getAuthStatus(machineState)).toEqual({
    status: 'checking_pin',
    user: electionManagerUser,
  });
  mockCard.checkPin.expectCallWith(pin).resolves({ response: 'correct' });
  await auth.checkPin(machineState, { pin });
  expect(await auth.getAuthStatus(machineState)).toEqual({
    status: 'logged_in',
    user: electionManagerUser,
    sessionExpiresAt: expect.any(Date),
  });
  mockOf(mockLogger.log).mockClear();
}

async function logInAsPollWorker(
  auth: InsertedSmartCardAuth,
  machineState: InsertedSmartCardAuthMachineState = defaultMachineState
) {
  mockCardStatus({
    status: 'ready',
    cardDetails: {
      user: pollWorkerUser,
      hasPin: false,
    },
  });
  expect(await auth.getAuthStatus(machineState)).toEqual({
    status: 'logged_in',
    user: pollWorkerUser,
    sessionExpiresAt: expect.any(Date),
  });
  mockOf(mockLogger.log).mockClear();
}

test('No card reader', async () => {
  const auth = new InsertedSmartCardAuth({
    card: mockCard,
    config: defaultConfig,
    logger: mockLogger,
  });

  mockCardStatus({ status: 'no_card_reader' });
  expect(await auth.getAuthStatus(defaultMachineState)).toEqual({
    status: 'logged_out',
    reason: 'no_card_reader',
  });
});

test.each<{
  description: string;
  cardStatus: CardStatus;
  expectedAuthStatus: InsertedSmartCardAuthTypes.AuthStatus;
  expectedLogOnInsertion?: Parameters<BaseLogger['log']>;
  expectedLogOnRemoval?: Parameters<BaseLogger['log']>;
}>([
  {
    description: 'unknown error',
    cardStatus: { status: 'unknown_error' },
    expectedAuthStatus: { status: 'logged_out', reason: 'no_card' },
  },
  {
    description: 'card error',
    cardStatus: { status: 'card_error' },
    expectedAuthStatus: { status: 'logged_out', reason: 'card_error' },
    expectedLogOnInsertion: [
      LogEventId.AuthLogin,
      'unknown',
      {
        disposition: LogDispositionStandardTypes.Failure,
        message: 'User failed login.',
        reason: 'card_error',
      },
    ],
  },
  {
    description: 'canceling PIN entry',
    cardStatus: {
      status: 'ready',
      cardDetails: {
        user: systemAdministratorUser,
      },
    },
    expectedAuthStatus: {
      status: 'checking_pin',
      user: systemAdministratorUser,
    },
    expectedLogOnRemoval: [
      LogEventId.AuthPinEntry,
      'system_administrator',
      {
        disposition: LogDispositionStandardTypes.Failure,
        message: 'User canceled PIN entry.',
      },
    ],
  },
])(
  'Card insertions and removals - $description',
  async ({
    cardStatus,
    expectedAuthStatus,
    expectedLogOnInsertion,
    expectedLogOnRemoval,
  }) => {
    const auth = new InsertedSmartCardAuth({
      card: mockCard,
      config: defaultConfig,
      logger: mockLogger,
    });

    mockCardStatus({ status: 'no_card' });
    expect(await auth.getAuthStatus(defaultMachineState)).toEqual({
      status: 'logged_out',
      reason: 'no_card',
    });

    mockCardStatus(cardStatus);
    expect(await auth.getAuthStatus(defaultMachineState)).toEqual(
      expectedAuthStatus
    );
    if (expectedLogOnInsertion) {
      expect(mockLogger.log).toHaveBeenCalledTimes(1);
      expect(mockLogger.log).toHaveBeenNthCalledWith(
        1,
        ...expectedLogOnInsertion
      );
    }

    mockCardStatus({ status: 'no_card' });
    expect(await auth.getAuthStatus(defaultMachineState)).toEqual({
      status: 'logged_out',
      reason: 'no_card',
    });
    if (expectedLogOnRemoval) {
      const logIndex = expectedLogOnInsertion ? 2 : 1;
      expect(mockLogger.log).toHaveBeenCalledTimes(logIndex);
      expect(mockLogger.log).toHaveBeenNthCalledWith(
        logIndex,
        ...expectedLogOnRemoval
      );
    }
  }
);

test.each<{
  description: string;
  machineState: DippedSmartCardAuthMachineState;
  cardDetails: CardDetails;
}>([
  {
    description: 'vendor card',
    machineState: defaultMachineState,
    cardDetails: {
      user: vendorUser,
    },
  },
  {
    description: 'system administrator card',
    machineState: defaultMachineState,
    cardDetails: {
      user: systemAdministratorUser,
    },
  },
  {
    description: 'election manager card',
    machineState: defaultMachineState,
    cardDetails: {
      user: electionManagerUser,
    },
  },
  {
    description: 'poll worker card with PIN',
    machineState: {
      ...defaultMachineState,
      arePollWorkerCardPinsEnabled: true,
    },
    cardDetails: {
      user: pollWorkerUser,
      hasPin: true,
    },
  },
])(
  'Login and logout using card with PIN - $description',
  async ({ machineState, cardDetails }) => {
    const auth = new InsertedSmartCardAuth({
      card: mockCard,
      config: defaultConfig,
      logger: mockLogger,
    });
    const { user } = cardDetails;

    mockCardStatus({ status: 'ready', cardDetails });
    expect(await auth.getAuthStatus(machineState)).toEqual({
      status: 'checking_pin',
      user,
    });

    mockCard.checkPin
      .expectCallWith(wrongPin)
      .resolves({ response: 'incorrect', numIncorrectPinAttempts: 1 });
    await auth.checkPin(machineState, { pin: wrongPin });
    expect(await auth.getAuthStatus(machineState)).toEqual({
      status: 'checking_pin',
      user,
      wrongPinEnteredAt: expect.any(Date),
    });
    expect(mockLogger.log).toHaveBeenCalledTimes(1);
    expect(mockLogger.log).toHaveBeenNthCalledWith(
      1,
      LogEventId.AuthPinEntry,
      user.role,
      {
        disposition: LogDispositionStandardTypes.Failure,
        message: 'User entered incorrect PIN.',
      }
    );

    mockCard.checkPin.expectCallWith(pin).resolves({ response: 'correct' });
    await auth.checkPin(machineState, { pin });
    expect(await auth.getAuthStatus(machineState)).toEqual({
      status: 'logged_in',
      user,
      sessionExpiresAt: expect.any(Date),
    });
    expect(mockLogger.log).toHaveBeenCalledTimes(3);
    expect(mockLogger.log).toHaveBeenNthCalledWith(
      2,
      LogEventId.AuthPinEntry,
      user.role,
      {
        disposition: LogDispositionStandardTypes.Success,
        message: 'User entered correct PIN.',
      }
    );
    expect(mockLogger.log).toHaveBeenNthCalledWith(
      3,
      LogEventId.AuthLogin,
      user.role,
      {
        disposition: LogDispositionStandardTypes.Success,
        message: 'User logged in.',
      }
    );

    mockCardStatus({ status: 'no_card' });
    expect(await auth.getAuthStatus(machineState)).toEqual({
      status: 'logged_out',
      reason: 'no_card',
    });
    expect(mockLogger.log).toHaveBeenCalledTimes(4);
    expect(mockLogger.log).toHaveBeenNthCalledWith(
      4,
      LogEventId.AuthLogout,
      user.role,
      {
        disposition: LogDispositionStandardTypes.Success,
        message: 'User logged out.',
        reason: 'no_card',
      }
    );
  }
);

test('Login and logout using card without PIN', async () => {
  const auth = new InsertedSmartCardAuth({
    card: mockCard,
    config: defaultConfig,
    logger: mockLogger,
  });

  mockCardStatus({
    status: 'ready',
    cardDetails: {
      user: pollWorkerUser,
      hasPin: false,
    },
  });
  expect(await auth.getAuthStatus(defaultMachineState)).toEqual({
    status: 'logged_in',
    user: pollWorkerUser,
    sessionExpiresAt: expect.any(Date),
  });
  expect(mockLogger.log).toHaveBeenCalledTimes(1);
  expect(mockLogger.log).toHaveBeenNthCalledWith(
    1,
    LogEventId.AuthLogin,
    'poll_worker',
    {
      disposition: LogDispositionStandardTypes.Success,
      message: 'User logged in.',
    }
  );

  mockCardStatus({ status: 'no_card' });
  expect(await auth.getAuthStatus(defaultMachineState)).toEqual({
    status: 'logged_out',
    reason: 'no_card',
  });
  expect(mockLogger.log).toHaveBeenCalledTimes(2);
  expect(mockLogger.log).toHaveBeenNthCalledWith(
    2,
    LogEventId.AuthLogout,
    'poll_worker',
    {
      disposition: LogDispositionStandardTypes.Success,
      message: 'User logged out.',
      reason: 'no_card',
    }
  );
});

test('Card lockout', async () => {
  const auth = new InsertedSmartCardAuth({
    card: mockCard,
    config: defaultConfig,
    logger: mockLogger,
  });
  const machineState: DippedSmartCardAuthMachineState = {
    ...defaultMachineState,
    // Intentionally pick non-default values to verify that machine state is being properly used
    numIncorrectPinAttemptsAllowedBeforeCardLockout: 3,
    startingCardLockoutDurationSeconds: 30,
  };

  mockCardStatus({
    status: 'ready',
    cardDetails: {
      user: electionManagerUser,
      numIncorrectPinAttempts: 2,
    },
  });
  expect(await auth.getAuthStatus(machineState)).toEqual({
    status: 'checking_pin',
    user: electionManagerUser,
  });

  mockCard.checkPin
    .expectCallWith(wrongPin)
    .resolves({ response: 'incorrect', numIncorrectPinAttempts: 3 });
  await auth.checkPin(machineState, { pin: wrongPin });
  expect(await auth.getAuthStatus(machineState)).toEqual({
    status: 'checking_pin',
    user: electionManagerUser,
    lockedOutUntil: mockTime.plus({ seconds: 30 }).toJSDate(),
    wrongPinEnteredAt: mockTime.toJSDate(),
  });

  mockCardStatus({ status: 'no_card' });
  expect(await auth.getAuthStatus(machineState)).toEqual({
    status: 'logged_out',
    reason: 'no_card',
  });

  mockTime = mockTime.plus({ seconds: 5 });
  jest.setSystemTime(mockTime.toJSDate());

  // Expect timer to reset when locked card is re-inserted
  mockCardStatus({
    status: 'ready',
    cardDetails: {
      user: electionManagerUser,
      numIncorrectPinAttempts: 3,
    },
  });
  expect(await auth.getAuthStatus(machineState)).toEqual({
    status: 'checking_pin',
    user: electionManagerUser,
    lockedOutUntil: mockTime.plus({ seconds: 30 }).toJSDate(),
  });
  expect(mockLogger.log).toHaveBeenCalledWith(
    LogEventId.AuthPinEntryLockout,
    expect.anything(),
    expect.anything()
  );

  // Expect checkPin call to be ignored when locked out
  await auth.checkPin(machineState, { pin });
  expect(await auth.getAuthStatus(machineState)).toEqual({
    status: 'checking_pin',
    user: electionManagerUser,
    lockedOutUntil: mockTime.plus({ seconds: 30 }).toJSDate(),
  });

  mockTime = mockTime.plus({ seconds: 30 });
  jest.setSystemTime(mockTime.toJSDate());

  // Expect checkPin call to go through after lockout ends and lockout time to double with
  // subsequent incorrect PIN attempts
  mockCard.checkPin
    .expectCallWith(wrongPin)
    .resolves({ response: 'incorrect', numIncorrectPinAttempts: 4 });
  await auth.checkPin(machineState, { pin: wrongPin });
  expect(await auth.getAuthStatus(machineState)).toEqual({
    status: 'checking_pin',
    user: electionManagerUser,
    lockedOutUntil: mockTime.plus({ seconds: 60 }).toJSDate(),
    wrongPinEnteredAt: mockTime.toJSDate(),
  });
});

test('Session expiry', async () => {
  const auth = new InsertedSmartCardAuth({
    card: mockCard,
    config: defaultConfig,
    logger: mockLogger,
  });
  const machineState: InsertedSmartCardAuthMachineState = {
    ...defaultMachineState,
    // Intentionally pick non-default value to verify that machine state is being properly used
    overallSessionTimeLimitHours: 2,
  };

  await logInAsElectionManager(auth, machineState);

  expect(await auth.getAuthStatus(machineState)).toEqual({
    status: 'logged_in',
    user: electionManagerUser,
    sessionExpiresAt: mockTime.plus({ hours: 2 }).toJSDate(),
  });

  mockTime = mockTime.plus({ hours: 2 });
  jest.setSystemTime(mockTime.toJSDate());

  expect(await auth.getAuthStatus(machineState)).toEqual({
    status: 'logged_out',
    reason: 'session_expired',
  });

  expect(mockLogger.log).toHaveBeenCalledWith(
    LogEventId.AuthLogout,
    'election_manager',
    expect.objectContaining({
      message: 'User logged out automatically due to session expiry.',
      reason: 'session_expired',
    })
  );

  // Because the card is still inserted, we'll automatically transition back to the PIN checking
  // state after session expiry
  expect(await auth.getAuthStatus(machineState)).toEqual({
    status: 'checking_pin',
    user: electionManagerUser,
  });
});

test('Updating session expiry', async () => {
  const auth = new InsertedSmartCardAuth({
    card: mockCard,
    config: defaultConfig,
    logger: mockLogger,
  });

  await logInAsElectionManager(auth, defaultMachineState);

  expect(await auth.getAuthStatus(defaultMachineState)).toEqual({
    status: 'logged_in',
    user: electionManagerUser,
    sessionExpiresAt: mockTime.plus({ hours: 12 }).toJSDate(),
  });

  await auth.updateSessionExpiry(defaultMachineState, {
    sessionExpiresAt: mockTime.plus({ seconds: 60 }).toJSDate(),
  });
  expect(await auth.getAuthStatus(defaultMachineState)).toEqual({
    status: 'logged_in',
    user: electionManagerUser,
    sessionExpiresAt: mockTime.plus({ seconds: 60 }).toJSDate(),
  });
});

test('Logout through logout method', async () => {
  const auth = new InsertedSmartCardAuth({
    card: mockCard,
    config: defaultConfig,
    logger: mockLogger,
  });

  await logInAsElectionManager(auth, defaultMachineState);

  // Because the card is still inserted, we'll automatically transition back to the PIN checking
  // state after logout
  auth.logOut(defaultMachineState);
  expect(await auth.getAuthStatus(defaultMachineState)).toEqual({
    status: 'checking_pin',
    user: electionManagerUser,
  });
});

test.each<{
  description: string;
  config: InsertedSmartCardAuthConfig;
  machineState: InsertedSmartCardAuthMachineState;
  cardDetails?: CardDetails;
  expectedAuthStatus: InsertedSmartCardAuthTypes.AuthStatus;
  expectedLog?: Parameters<BaseLogger['log']>;
}>([
  {
    description: 'invalid user on card',
    config: defaultConfig,
    machineState: defaultMachineState,
    cardDetails: undefined,
    expectedAuthStatus: {
      status: 'logged_out',
      reason: 'invalid_user_on_card',
      machineJurisdiction: jurisdiction,
    },
    expectedLog: [
      LogEventId.AuthLogin,
      'unknown',
      {
        disposition: LogDispositionStandardTypes.Failure,
        message: 'User failed login.',
        reason: 'invalid_user_on_card',
      },
    ],
  },
  {
    description: 'wrong jurisdiction',
    config: defaultConfig,
    machineState: defaultMachineState,
    cardDetails: {
      user: { ...systemAdministratorUser, jurisdiction: otherJurisdiction },
    },
    expectedAuthStatus: {
      status: 'logged_out',
      reason: 'wrong_jurisdiction',
      cardJurisdiction: otherJurisdiction,
      cardUserRole: 'system_administrator',
      machineJurisdiction: jurisdiction,
    },
    expectedLog: [
      LogEventId.AuthLogin,
      'system_administrator',
      {
        disposition: LogDispositionStandardTypes.Failure,
        message: 'User failed login.',
        reason: 'wrong_jurisdiction',
      },
    ],
  },
  {
    description:
      'skips jurisdiction validation if vendor card with wildcard jurisdiction',
    config: defaultConfig,
    machineState: defaultMachineState,
    cardDetails: {
      user: { ...vendorUser, jurisdiction: '*' },
    },
    expectedAuthStatus: {
      status: 'checking_pin',
      user: { ...vendorUser, jurisdiction: '*' },
    },
  },
  {
    description:
      'does not skip jurisdiction validation if non-vendor card with wildcard jurisdiction',
    config: defaultConfig,
    machineState: defaultMachineState,
    cardDetails: {
      user: { ...systemAdministratorUser, jurisdiction: '*' },
    },
    expectedAuthStatus: {
      status: 'logged_out',
      reason: 'wrong_jurisdiction',
      cardJurisdiction: '*',
      cardUserRole: 'system_administrator',
      machineJurisdiction: jurisdiction,
    },
    expectedLog: [
      LogEventId.AuthLogin,
      'system_administrator',
      {
        disposition: LogDispositionStandardTypes.Failure,
        message: 'User failed login.',
        reason: 'wrong_jurisdiction',
      },
    ],
  },
  {
    description: 'skips jurisdiction validation if no machine jurisdiction',
    config: defaultConfig,
    machineState: { ...defaultMachineState, jurisdiction: undefined },
    cardDetails: {
      user: systemAdministratorUser,
    },
    expectedAuthStatus: {
      status: 'checking_pin',
      user: systemAdministratorUser,
    },
  },
  {
    description: 'election manager can access unconfigured machine',
    config: defaultConfig,
    machineState: { ...defaultMachineState, electionKey: undefined },
    cardDetails: {
      user: electionManagerUser,
    },
    expectedAuthStatus: {
      status: 'checking_pin',
      user: electionManagerUser,
    },
  },
  {
    description: 'poll worker cannot access unconfigured machine',
    config: defaultConfig,
    machineState: { ...defaultMachineState, electionKey: undefined },
    cardDetails: {
      user: pollWorkerUser,
      hasPin: false,
    },
    expectedAuthStatus: {
      status: 'logged_out',
      reason: 'machine_not_configured',
      cardJurisdiction: jurisdiction,
      cardUserRole: 'poll_worker',
      machineJurisdiction: jurisdiction,
    },
    expectedLog: [
      LogEventId.AuthLogin,
      'poll_worker',
      {
        disposition: LogDispositionStandardTypes.Failure,
        message: 'User failed login.',
        reason: 'machine_not_configured',
      },
    ],
  },
  {
    description: 'election manager card with mismatched election key',
    config: defaultConfig,
    machineState: defaultMachineState,
    cardDetails: {
      user: { ...electionManagerUser, electionKey: otherElectionKey },
    },
    expectedAuthStatus: {
      status: 'logged_out',
      reason: 'wrong_election',
      cardJurisdiction: jurisdiction,
      cardUserRole: 'election_manager',
      machineJurisdiction: jurisdiction,
    },
    expectedLog: [
      LogEventId.AuthLogin,
      'election_manager',
      {
        disposition: LogDispositionStandardTypes.Failure,
        message: 'User failed login.',
        reason: 'wrong_election',
      },
    ],
  },
  {
    description: 'poll worker card with mismatched election key',
    config: defaultConfig,
    machineState: defaultMachineState,
    cardDetails: {
      user: { ...pollWorkerUser, electionKey: otherElectionKey },
      hasPin: false,
    },
    expectedAuthStatus: {
      status: 'logged_out',
      reason: 'wrong_election',
      cardJurisdiction: jurisdiction,
      cardUserRole: 'poll_worker',
      machineJurisdiction: jurisdiction,
    },
    expectedLog: [
      LogEventId.AuthLogin,
      'poll_worker',
      {
        disposition: LogDispositionStandardTypes.Failure,
        message: 'User failed login.',
        reason: 'wrong_election',
      },
    ],
  },
  {
    description:
      'poll worker card without PIN when poll worker card PINs are enabled',
    config: defaultConfig,
    machineState: {
      ...defaultMachineState,
      arePollWorkerCardPinsEnabled: true,
    },
    cardDetails: {
      user: pollWorkerUser,
      hasPin: false,
    },
    expectedAuthStatus: {
      status: 'logged_out',
      reason: 'invalid_user_on_card',
      cardJurisdiction: jurisdiction,
      cardUserRole: 'poll_worker',
      machineJurisdiction: jurisdiction,
    },
    expectedLog: [
      LogEventId.AuthLogin,
      'poll_worker',
      {
        disposition: LogDispositionStandardTypes.Failure,
        message: 'User failed login.',
        reason: 'invalid_user_on_card',
      },
    ],
  },
  {
    description:
      'poll worker card with PIN when poll worker card PINs are not enabled',
    config: defaultConfig,
    machineState: defaultMachineState,
    cardDetails: {
      user: pollWorkerUser,
      hasPin: true,
    },
    expectedAuthStatus: {
      status: 'logged_out',
      reason: 'invalid_user_on_card',
      cardJurisdiction: jurisdiction,
      cardUserRole: 'poll_worker',
      machineJurisdiction: jurisdiction,
    },
    expectedLog: [
      LogEventId.AuthLogin,
      'poll_worker',
      {
        disposition: LogDispositionStandardTypes.Failure,
        message: 'User failed login.',
        reason: 'invalid_user_on_card',
      },
    ],
  },
])(
  'Card validation - $description',
  async ({
    config,
    machineState,
    cardDetails,
    expectedAuthStatus,
    expectedLog,
  }) => {
    const auth = new InsertedSmartCardAuth({
      card: mockCard,
      config,
      logger: mockLogger,
    });

    mockCardStatus({ status: 'ready', cardDetails });
    expect(await auth.getAuthStatus(machineState)).toEqual(expectedAuthStatus);
    if (expectedLog) {
      expect(mockLogger.log).toHaveBeenCalledTimes(1);
      expect(mockLogger.log).toHaveBeenNthCalledWith(1, ...expectedLog);
    }
  }
);

test('Cardless voter sessions - ending preemptively', async () => {
  const auth = new InsertedSmartCardAuth({
    card: mockCard,
    config: { ...defaultConfig, allowCardlessVoterSessions: true },
    logger: mockLogger,
  });

  await logInAsPollWorker(auth);

  // Start cardless voter session
  await auth.startCardlessVoterSession(defaultMachineState, {
    ballotStyleId: cardlessVoterUser.ballotStyleId,
    precinctId: cardlessVoterUser.precinctId,
  });
  expect(await auth.getAuthStatus(defaultMachineState)).toEqual({
    status: 'logged_in',
    user: pollWorkerUser,
    sessionExpiresAt: expect.any(Date),
    cardlessVoterUser: {
      ...cardlessVoterUser,
      sessionId: expect.any(String),
    },
  });
  expect(mockLogger.log).toHaveBeenCalledTimes(1);
  expect(mockLogger.log).toHaveBeenNthCalledWith(
    1,
    LogEventId.AuthLogin,
    'cardless_voter',
    {
      disposition: LogDispositionStandardTypes.Success,
      message: 'Cardless voter session started.',
    }
  );

  // End cardless voter session before removing poll worker card
  await auth.endCardlessVoterSession();
  expect(await auth.getAuthStatus(defaultMachineState)).toEqual({
    status: 'logged_in',
    user: pollWorkerUser,
    sessionExpiresAt: expect.any(Date),
  });
  expect(mockLogger.log).toHaveBeenCalledTimes(2);
  expect(mockLogger.log).toHaveBeenNthCalledWith(
    2,
    LogEventId.AuthLogout,
    'cardless_voter',
    {
      disposition: LogDispositionStandardTypes.Success,
      message: 'Cardless voter session ended.',
    }
  );
});

test('Cardless voter sessions - end-to-end', async () => {
  const auth = new InsertedSmartCardAuth({
    card: mockCard,
    config: { ...defaultConfig, allowCardlessVoterSessions: true },
    logger: mockLogger,
  });

  await logInAsPollWorker(auth);

  // Start cardless voter session
  await auth.startCardlessVoterSession(defaultMachineState, {
    ballotStyleId: cardlessVoterUser.ballotStyleId,
    precinctId: cardlessVoterUser.precinctId,
  });
  expect(await auth.getAuthStatus(defaultMachineState)).toEqual({
    status: 'logged_in',
    user: pollWorkerUser,
    sessionExpiresAt: expect.any(Date),
    cardlessVoterUser: {
      ...cardlessVoterUser,
      sessionId: expect.any(String),
    },
  });
  expect(mockLogger.log).toHaveBeenCalledTimes(1);
  expect(mockLogger.log).toHaveBeenNthCalledWith(
    1,
    LogEventId.AuthLogin,
    'cardless_voter',
    {
      disposition: LogDispositionStandardTypes.Success,
      message: 'Cardless voter session started.',
    }
  );

  // Remove poll worker card, granting control to cardless voter
  mockCardStatus({ status: 'no_card' });
  expect(await auth.getAuthStatus(defaultMachineState)).toEqual({
    status: 'logged_in',
    user: {
      ...cardlessVoterUser,
      sessionId: expect.any(String),
    },
    sessionExpiresAt: expect.any(Date),
  });
  expect(mockLogger.log).toHaveBeenCalledTimes(2);
  expect(mockLogger.log).toHaveBeenNthCalledWith(
    2,
    LogEventId.AuthLogout,
    'poll_worker',
    {
      disposition: LogDispositionStandardTypes.Success,
      message: 'User logged out.',
      reason: 'no_card',
    }
  );

  // Insert poll worker card in the middle of cardless voter session
  mockCardStatus({
    status: 'ready',
    cardDetails: {
      user: pollWorkerUser,
      hasPin: false,
    },
  });
  expect(await auth.getAuthStatus(defaultMachineState)).toEqual({
    status: 'logged_in',
    user: pollWorkerUser,
    sessionExpiresAt: expect.any(Date),
    cardlessVoterUser: {
      ...cardlessVoterUser,
      sessionId: expect.any(String),
    },
  });
  expect(mockLogger.log).toHaveBeenCalledTimes(3);
  expect(mockLogger.log).toHaveBeenNthCalledWith(
    3,
    LogEventId.AuthLogin,
    'poll_worker',
    {
      disposition: LogDispositionStandardTypes.Success,
      message: 'User logged in.',
    }
  );

  // Re-remove poll worker card, granting control back to cardless voter
  mockCardStatus({ status: 'no_card' });
  expect(await auth.getAuthStatus(defaultMachineState)).toEqual({
    status: 'logged_in',
    user: {
      ...cardlessVoterUser,
      sessionId: expect.any(String),
    },
    sessionExpiresAt: expect.any(Date),
  });
  expect(mockLogger.log).toHaveBeenCalledTimes(4);
  expect(mockLogger.log).toHaveBeenNthCalledWith(
    4,
    LogEventId.AuthLogout,
    'poll_worker',
    {
      disposition: LogDispositionStandardTypes.Success,
      message: 'User logged out.',
      reason: 'no_card',
    }
  );

  // End cardless voter session
  await auth.endCardlessVoterSession();
  expect(await auth.getAuthStatus(defaultMachineState)).toEqual({
    status: 'logged_out',
    reason: 'no_card',
  });
  expect(mockLogger.log).toHaveBeenCalledTimes(5);
  expect(mockLogger.log).toHaveBeenNthCalledWith(
    5,
    LogEventId.AuthLogout,
    'cardless_voter',
    {
      disposition: LogDispositionStandardTypes.Success,
      message: 'Cardless voter session ended.',
    }
  );
});

test('Reading card data', async () => {
  const auth = new InsertedSmartCardAuth({
    card: mockCard,
    config: defaultConfig,
    logger: mockLogger,
  });

  mockCard.readData
    .expectCallWith()
    .resolves(Buffer.from(electionData, 'utf-8'));
  expect(await auth.readCardData()).toEqual(ok(electionData));

  mockCard.readData.expectCallWith().resolves(Buffer.of());
  expect(await auth.readCardData()).toEqual(ok(undefined));
});

test('Writing card data', async () => {
  const auth = new InsertedSmartCardAuth({
    card: mockCard,
    config: defaultConfig,
    logger: mockLogger,
  });

  mockCard.writeData
    .expectCallWith(Buffer.from(JSON.stringify(election), 'utf-8'))
    .resolves();
  mockCard.readData
    .expectCallWith()
    .resolves(Buffer.from(JSON.stringify(election), 'utf-8'));
  expect(await auth.writeCardData({ data: JSON.stringify(election) })).toEqual(
    ok()
  );
});

test('Clearing card data', async () => {
  const auth = new InsertedSmartCardAuth({
    card: mockCard,
    config: defaultConfig,
    logger: mockLogger,
  });

  mockCard.clearData.expectCallWith().resolves();
  expect(await auth.clearCardData()).toEqual(ok());
});

test('Checking PIN error handling', async () => {
  const auth = new InsertedSmartCardAuth({
    card: mockCard,
    config: defaultConfig,
    logger: mockLogger,
  });

  mockCardStatus({
    status: 'ready',
    cardDetails: {
      user: electionManagerUser,
    },
  });
  expect(await auth.getAuthStatus(defaultMachineState)).toEqual({
    status: 'checking_pin',
    user: electionManagerUser,
  });

  mockCard.checkPin.expectCallWith(pin).throws(new Error('Whoa!'));
  await auth.checkPin(defaultMachineState, { pin });
  expect(await auth.getAuthStatus(defaultMachineState)).toEqual({
    status: 'checking_pin',
    user: electionManagerUser,
    error: true,
  });
  expect(mockLogger.log).toHaveBeenCalledTimes(1);
  expect(mockLogger.log).toHaveBeenNthCalledWith(
    1,
    LogEventId.AuthPinEntry,
    'election_manager',
    {
      disposition: LogDispositionStandardTypes.Failure,
      message: 'Error checking PIN: Whoa!',
    }
  );

  // Check that "successfully" entering an incorrect PIN clears the error state
  mockCard.checkPin
    .expectCallWith(wrongPin)
    .resolves({ response: 'incorrect', numIncorrectPinAttempts: 1 });
  await auth.checkPin(defaultMachineState, { pin: wrongPin });
  expect(await auth.getAuthStatus(defaultMachineState)).toEqual({
    status: 'checking_pin',
    user: electionManagerUser,
    wrongPinEnteredAt: expect.any(Date),
  });
  expect(mockLogger.log).toHaveBeenCalledTimes(2);
  expect(mockLogger.log).toHaveBeenNthCalledWith(
    2,
    LogEventId.AuthPinEntry,
    'election_manager',
    {
      disposition: LogDispositionStandardTypes.Failure,
      message: 'User entered incorrect PIN.',
    }
  );

  // Check that wrong PIN entry state is maintained after an error
  mockCard.checkPin.expectCallWith(pin).throws(new Error('Whoa!'));
  await auth.checkPin(defaultMachineState, { pin });
  expect(await auth.getAuthStatus(defaultMachineState)).toEqual({
    status: 'checking_pin',
    user: electionManagerUser,
    error: true,
    wrongPinEnteredAt: expect.any(Date),
  });
  expect(mockLogger.log).toHaveBeenCalledTimes(3);
  expect(mockLogger.log).toHaveBeenNthCalledWith(
    3,
    LogEventId.AuthPinEntry,
    'election_manager',
    {
      disposition: LogDispositionStandardTypes.Failure,
      message: 'Error checking PIN: Whoa!',
    }
  );

  mockCard.checkPin.expectCallWith(pin).resolves({ response: 'correct' });
  await auth.checkPin(defaultMachineState, { pin });
  expect(await auth.getAuthStatus(defaultMachineState)).toEqual({
    status: 'logged_in',
    user: electionManagerUser,
    sessionExpiresAt: expect.any(Date),
  });
});

test(
  'Attempting to check a PIN when not in PIN checking state, ' +
    'e.g. because someone removed their card right after entering their PIN',
  async () => {
    const auth = new InsertedSmartCardAuth({
      card: mockCard,
      config: defaultConfig,
      logger: mockLogger,
    });

    mockCardStatus({ status: 'no_card' });
    mockCard.checkPin
      .expectCallWith(pin)
      .throws(new Error('Whoa! Card no longer in reader'));
    await auth.checkPin(defaultMachineState, { pin });
    expect(await auth.getAuthStatus(defaultMachineState)).toEqual({
      status: 'logged_out',
      reason: 'no_card',
    });
    expect(mockLogger.log).toHaveBeenCalledTimes(1);
    expect(mockLogger.log).toHaveBeenNthCalledWith(
      1,
      LogEventId.AuthPinEntry,
      'unknown',
      {
        disposition: LogDispositionStandardTypes.Failure,
        message: 'Error checking PIN: Whoa! Card no longer in reader',
      }
    );
  }
);

test('Attempting to update session expiry when not logged in', async () => {
  const auth = new InsertedSmartCardAuth({
    card: mockCard,
    config: defaultConfig,
    logger: mockLogger,
  });

  mockCardStatus({ status: 'no_card' });
  expect(await auth.getAuthStatus(defaultMachineState)).toEqual({
    status: 'logged_out',
    reason: 'no_card',
  });

  await auth.updateSessionExpiry(defaultMachineState, {
    sessionExpiresAt: new Date(),
  });
  expect(await auth.getAuthStatus(defaultMachineState)).toEqual({
    status: 'logged_out',
    reason: 'no_card',
  });
});

test('Attempting to start a cardless voter session when logged out', async () => {
  const auth = new InsertedSmartCardAuth({
    card: mockCard,
    config: { ...defaultConfig, allowCardlessVoterSessions: true },
    logger: mockLogger,
  });

  mockCardStatus({ status: 'no_card' });
  expect(await auth.getAuthStatus(defaultMachineState)).toEqual({
    status: 'logged_out',
    reason: 'no_card',
  });

  await auth.startCardlessVoterSession(defaultMachineState, {
    ballotStyleId: cardlessVoterUser.ballotStyleId,
    precinctId: cardlessVoterUser.precinctId,
  });
  expect(await auth.getAuthStatus(defaultMachineState)).toEqual({
    status: 'logged_out',
    reason: 'no_card',
  });
});

test('Attempting to start a cardless voter session when not a poll worker', async () => {
  const auth = new InsertedSmartCardAuth({
    card: mockCard,
    config: { ...defaultConfig, allowCardlessVoterSessions: true },
    logger: mockLogger,
  });

  await logInAsElectionManager(auth);

  await auth.startCardlessVoterSession(defaultMachineState, {
    ballotStyleId: cardlessVoterUser.ballotStyleId,
    precinctId: cardlessVoterUser.precinctId,
  });
  expect(await auth.getAuthStatus(defaultMachineState)).toEqual({
    status: 'logged_in',
    user: electionManagerUser,
    sessionExpiresAt: expect.any(Date),
  });
});

test('Attempting to start a cardless voter session when not allowed by config', async () => {
  const auth = new InsertedSmartCardAuth({
    card: mockCard,
    config: defaultConfig,
    logger: mockLogger,
  });

  await logInAsPollWorker(auth);

  await expect(
    auth.startCardlessVoterSession(defaultMachineState, {
      ballotStyleId: cardlessVoterUser.ballotStyleId,
      precinctId: cardlessVoterUser.precinctId,
    })
  ).rejects.toThrow();
  await expect(auth.endCardlessVoterSession()).rejects.toThrow();
});

test('Reading card data error handling', async () => {
  const auth = new InsertedSmartCardAuth({
    card: mockCard,
    config: defaultConfig,
    logger: mockLogger,
  });

  mockCard.readData.expectCallWith().throws(new Error('Whoa!'));
  expect(await auth.readCardData()).toEqual(err(new Error('Whoa!')));
});

test('Writing card data error handling', async () => {
  const auth = new InsertedSmartCardAuth({
    card: mockCard,
    config: defaultConfig,
    logger: mockLogger,
  });

  mockCard.writeData
    .expectCallWith(Buffer.from(JSON.stringify(election), 'utf-8'))
    .throws(new Error('Whoa!'));
  expect(await auth.writeCardData({ data: JSON.stringify(election) })).toEqual(
    err(new Error('Whoa!'))
  );

  mockCard.writeData
    .expectCallWith(Buffer.from(JSON.stringify(election), 'utf-8'))
    .resolves();
  mockCard.readData.expectCallWith().throws(new Error('Whoa!'));
  expect(
    await auth.writeCardData({
      data: JSON.stringify(election),
    })
  ).toEqual(err(new Error('Verification of write by reading data failed')));
});

test('Clearing card data error handling', async () => {
  const auth = new InsertedSmartCardAuth({
    card: mockCard,
    config: defaultConfig,
    logger: mockLogger,
  });

  mockCard.clearData.expectCallWith().throws(new Error('Whoa!'));
  expect(await auth.clearCardData()).toEqual(err(new Error('Whoa!')));
});

test.each<{
  description: string;
  machineState: DippedSmartCardAuthMachineState;
  cardDetails: CardDetails;
}>([
  {
    description: 'vendor card',
    machineState: defaultMachineState,
    cardDetails: {
      user: vendorUser,
    },
  },
  {
    description: 'system administrator card',
    machineState: defaultMachineState,
    cardDetails: {
      user: systemAdministratorUser,
    },
  },
  {
    description: 'election manager card',
    machineState: defaultMachineState,
    cardDetails: {
      user: electionManagerUser,
    },
  },
  {
    description: 'poll worker card with PIN',
    machineState: {
      ...defaultMachineState,
      arePollWorkerCardPinsEnabled: true,
    },
    cardDetails: {
      user: pollWorkerUser,
      hasPin: true,
    },
  },
])(
  'SKIP_PIN_ENTRY feature flag - $description',
  async ({ machineState, cardDetails }) => {
    mockFeatureFlagger.enableFeatureFlag(
      BooleanEnvironmentVariableName.SKIP_PIN_ENTRY
    );
    const auth = new InsertedSmartCardAuth({
      card: mockCard,
      config: defaultConfig,
      logger: mockLogger,
    });
    const { user } = cardDetails;

    mockCardStatus({ status: 'ready', cardDetails });
    expect(await auth.getAuthStatus(machineState)).toEqual({
      status: 'logged_in',
      user,
      sessionExpiresAt: expect.any(Date),
    });
  }
);

describe('updateCardlessVoterBallotStyle', () => {
  function newApi() {
    return new InsertedSmartCardAuth({
      card: mockCard,
      config: { ...defaultConfig, allowCardlessVoterSessions: true },
      logger: mockLogger,
    });
  }

  test("fails when there's no existing voter session", async () => {
    const api = newApi();

    await expect(() =>
      api.updateCardlessVoterBallotStyle({
        ballotStyleId: '1_en' as BallotStyleId,
      })
    ).rejects.toThrow();
  });

  test('updates existing session ballot style', async () => {
    const api = newApi();

    await logInAsPollWorker(api);

    await api.startCardlessVoterSession(defaultMachineState, {
      ballotStyleId: '1_en' as BallotStyleId,
      precinctId: 'precinct1',
    });

    mockCardStatus({ status: 'no_card' });

    const initialStatus = await api.getAuthStatus(defaultMachineState);
    assert(
      initialStatus.status === 'logged_in' &&
        initialStatus.user.role === 'cardless_voter'
    );
    expect(initialStatus.user).toEqual(
      expect.objectContaining({ ballotStyleId: '1_en' })
    );

    mockOf(mockLogger.log).mockClear();

    await api.updateCardlessVoterBallotStyle({
      ballotStyleId: '1_es-US' as BallotStyleId,
    });

    const updatedStatus = await api.getAuthStatus(defaultMachineState);
    expect(updatedStatus).toEqual({
      ...initialStatus,
      user: { ...initialStatus.user, ballotStyleId: '1_es-US' },
    });

    expect(mockLogger.log).toHaveBeenCalledWith(
      LogEventId.AuthVoterSessionUpdated,
      'cardless_voter',
      {
        disposition: LogDispositionStandardTypes.Success,
        message: expect.stringMatching(/updated .* 1_en .* 1_es-US/),
      }
    );
  });

  test('is a no-op for unchanged ballot style ID', async () => {
    const api = newApi();

    await logInAsPollWorker(api);
    await api.startCardlessVoterSession(defaultMachineState, {
      ballotStyleId: '1_en' as BallotStyleId,
      precinctId: 'precinct1',
    });
    mockCardStatus({ status: 'no_card' });

    const initialStatus = await api.getAuthStatus(defaultMachineState);

    mockOf(mockLogger.log).mockClear();
    await api.updateCardlessVoterBallotStyle({
      ballotStyleId: '1_en' as BallotStyleId,
    });

    const updatedStatus = await api.getAuthStatus(defaultMachineState);
    expect(updatedStatus).toEqual(initialStatus);

    expect(mockLogger.log).not.toHaveBeenCalled();
  });
});
