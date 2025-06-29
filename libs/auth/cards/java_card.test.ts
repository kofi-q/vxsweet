jest.mock('./card_reader');

jest.mock(
  '../cryptography/cryptography',
  (): typeof import('../cryptography/cryptography') => ({
    // We use real cryptographic commands in these tests to ensure end-to-end correctness, the one
    // exception being commands for cert creation since two cert creation commands with the exact
    // same inputs won't necessarily generate the same outputs, making assertions difficult
    ...jest.requireActual('../cryptography/cryptography'),
    createCert: jest.fn(),
  })
);

import { Buffer } from 'node:buffer';
import * as fs from 'node:fs';
import { sha256 } from 'js-sha256';
import waitForExpect from 'wait-for-expect';
import { assert } from '@vx/libs/basics/assert';
import { election as electionFamousNames } from '@vx/libs/fixtures/src/data/electionFamousNames2021/election.json';
import {
  mockElectionManagerUser,
  mockPollWorkerUser,
  mockSystemAdministratorUser,
  mockOf,
  mockVendorUser,
} from '@vx/libs/test-utils/src';
import { type Byte } from '@vx/libs/types/basic';
import {
  constructElectionKey,
  TEST_JURISDICTION,
} from '@vx/libs/types/elections';

import {
  getTestFilePath,
  MockCardReader,
  type TestFileSetId,
  TestJavaCard,
} from '../test/utils';
import {
  CardCommand,
  constructTlv,
  ResponseApduError,
  SELECT,
  STATUS_WORD,
} from '../apdu/apdu';
import {
  type CardDetails,
  type CheckPinResponse,
  type ProgrammableCard,
} from './card';
import { CardReader } from './card_reader';
import { type CardType } from './certs';
import { type JavaCardConfig } from '../config/config';
import {
  certDerToPem,
  createCert,
  openssl,
  PUBLIC_KEY_IN_DER_FORMAT_HEADER,
  publicKeyDerToPem,
} from '../cryptography/cryptography';
import {
  CARD_IDENTITY_CERT,
  CARD_VX_CERT,
  DEFAULT_PIN,
  GENERIC_STORAGE_SPACE,
  GENERIC_STORAGE_SPACE_CAPACITY_BYTES,
  JavaCard,
  MAX_NUM_INCORRECT_PIN_ATTEMPTS,
  OPEN_FIPS_201_AID,
  PUK,
  VX_ADMIN_CERT_AUTHORITY_CERT,
} from './java_card';
import {
  construct8BytePinBuffer,
  CRYPTOGRAPHIC_ALGORITHM_IDENTIFIER,
  GENERAL_AUTHENTICATE,
  GENERATE_ASYMMETRIC_KEY_PAIR,
  GET_DATA,
  PUT_DATA,
  RESET_RETRY_COUNTER,
  VERIFY,
} from '../src/piv';
import { mockLogger } from '@vx/libs/logging/src';

let mockCardReader: MockCardReader;

beforeEach(() => {
  (CardReader as jest.MockedClass<typeof CardReader>).mockImplementation(
    (...params) => {
      mockCardReader = new MockCardReader(...params);
      return mockCardReader as unknown as CardReader;
    }
  );
  mockOf(createCert).mockImplementation(() => Promise.resolve(Buffer.of()));
});

afterEach(() => {
  mockCardReader.transmit.assertComplete();
});

const electionKey = constructElectionKey(electionFamousNames);
const vendorUser = mockVendorUser();
const systemAdministratorUser = mockSystemAdministratorUser();
const electionManagerUser = mockElectionManagerUser({ electionKey });
const pollWorkerUser = mockPollWorkerUser({ electionKey });

const mockChallenge = 'VotingWorks';
function generateChallengeOverride(): string {
  return mockChallenge;
}

const config: JavaCardConfig = {
  generateChallengeOverride,
  vxCertAuthorityCertPath: getTestFilePath({
    fileType: 'vx-cert-authority-cert.pem',
  }),
};

const configWithVxAdminCardProgrammingConfig: JavaCardConfig = {
  ...config,
  cardProgrammingConfig: {
    configType: 'vx_admin',
    vxAdminCertAuthorityCertPath: getTestFilePath({
      fileType: 'vx-admin-cert-authority-cert.pem',
    }),
    vxAdminPrivateKey: {
      source: 'file',
      path: getTestFilePath({
        fileType: 'vx-admin-private-key.pem',
      }),
    },
  },
};

const configWithVxCardProgrammingConfig: JavaCardConfig = {
  ...config,
  cardProgrammingConfig: {
    configType: 'vx',
    vxPrivateKey: {
      source: 'file',
      path: getTestFilePath({
        fileType: 'vx-private-key.pem',
      }),
    },
  },
};

function mockCardAppletSelectionRequest(): void {
  const command = new CardCommand({
    ins: SELECT.INS,
    p1: SELECT.P1,
    p2: SELECT.P2,
    data: Buffer.from(OPEN_FIPS_201_AID, 'hex'),
  });
  const responseData = Buffer.of();
  mockCardReader.transmit.expectCallWith(command).resolves(responseData);
}

function mockCardCertRetrievalRequest(
  certObjectId: Buffer,
  certPath: string
): void {
  const command = new CardCommand({
    ins: GET_DATA.INS,
    p1: GET_DATA.P1,
    p2: GET_DATA.P2,
    data: constructTlv(GET_DATA.TAG_LIST_TAG, certObjectId),
  });
  const responseData = constructTlv(
    PUT_DATA.DATA_TAG,
    Buffer.concat([
      constructTlv(PUT_DATA.CERT_TAG, fs.readFileSync(certPath)),
      constructTlv(
        PUT_DATA.CERT_INFO_TAG,
        Buffer.of(PUT_DATA.CERT_INFO_UNCOMPRESSED)
      ),
      constructTlv(PUT_DATA.ERROR_DETECTION_CODE_TAG, Buffer.of()),
    ])
  );
  mockCardReader.transmit.expectCallWith(command).resolves(responseData);
}

async function mockCardSignatureRequest(
  privateKeyId: Byte,
  privateKeyPath: string,
  error?: Error
): Promise<void> {
  const challengeHash = Buffer.from(sha256.arrayBuffer(mockChallenge));
  const command = new CardCommand({
    ins: GENERAL_AUTHENTICATE.INS,
    p1: CRYPTOGRAPHIC_ALGORITHM_IDENTIFIER.ECC256,
    p2: privateKeyId,
    data: constructTlv(
      GENERAL_AUTHENTICATE.DYNAMIC_AUTHENTICATION_TEMPLATE_TAG,
      Buffer.concat([
        constructTlv(GENERAL_AUTHENTICATE.CHALLENGE_TAG, challengeHash),
        constructTlv(GENERAL_AUTHENTICATE.RESPONSE_TAG, Buffer.of()),
      ])
    ),
  });
  if (error) {
    mockCardReader.transmit.expectCallWith(command).throws(error);
    return;
  }
  const challengeSignature = await openssl([
    'dgst',
    '-sha256',
    '-sign',
    privateKeyPath,
    Buffer.from(mockChallenge, 'utf-8'),
  ]);
  const responseData = constructTlv(
    GENERAL_AUTHENTICATE.DYNAMIC_AUTHENTICATION_TEMPLATE_TAG,
    Buffer.concat([
      constructTlv(GENERAL_AUTHENTICATE.RESPONSE_TAG, challengeSignature),
    ])
  );
  mockCardReader.transmit.expectCallWith(command).resolves(responseData);
}

function mockCardPinVerificationRequest(pin: string, error?: Error): void {
  const command = new CardCommand({
    ins: VERIFY.INS,
    p1: VERIFY.P1_VERIFY,
    p2: VERIFY.P2_PIN,
    data: construct8BytePinBuffer(pin),
  });
  if (error) {
    mockCardReader.transmit.expectCallWith(command).throws(error);
    return;
  }
  const responseData = Buffer.of();
  mockCardReader.transmit.expectCallWith(command).resolves(responseData);
}

function mockCardGetNumRemainingPinAttemptsRequest(
  numRemainingPinAttemptsOrError: number | Error
): void {
  const command = new CardCommand({
    ins: VERIFY.INS,
    p1: VERIFY.P1_VERIFY,
    p2: VERIFY.P2_PIN,
  });
  if (numRemainingPinAttemptsOrError instanceof Error) {
    mockCardReader.transmit
      .expectCallWith(command)
      .throws(numRemainingPinAttemptsOrError);
    return;
  }
  // The data is returned in what would typically be considered an error
  const responseData = new ResponseApduError([
    STATUS_WORD.VERIFY_FAIL.SW1,
    (0xc0 +
      (numRemainingPinAttemptsOrError ??
        MAX_NUM_INCORRECT_PIN_ATTEMPTS)) as Byte,
  ]);
  mockCardReader.transmit.expectCallWith(command).throws(responseData);
}

function mockCardPinResetRequest(newPin: string): void {
  const command = new CardCommand({
    ins: RESET_RETRY_COUNTER.INS,
    p1: RESET_RETRY_COUNTER.P1,
    p2: RESET_RETRY_COUNTER.P2,
    data: Buffer.concat([PUK, construct8BytePinBuffer(newPin)]),
  });
  const responseData = Buffer.of();
  mockCardReader.transmit.expectCallWith(command).resolves(responseData);
}

function mockCardKeyPairGenerationRequest(
  privateKeyId: Byte,
  publicKeyPath: string
): void {
  const command = new CardCommand({
    ins: GENERATE_ASYMMETRIC_KEY_PAIR.INS,
    p1: GENERATE_ASYMMETRIC_KEY_PAIR.P1,
    p2: privateKeyId,
    data: constructTlv(
      GENERATE_ASYMMETRIC_KEY_PAIR.CRYPTOGRAPHIC_ALGORITHM_IDENTIFIER_TEMPLATE_TAG,
      constructTlv(
        GENERATE_ASYMMETRIC_KEY_PAIR.CRYPTOGRAPHIC_ALGORITHM_IDENTIFIER_TAG,
        Buffer.of(CRYPTOGRAPHIC_ALGORITHM_IDENTIFIER.ECC256)
      )
    ),
  });
  const publicKeyRawData = fs
    .readFileSync(publicKeyPath)
    .subarray(PUBLIC_KEY_IN_DER_FORMAT_HEADER.length);
  const responseData = constructTlv(
    GENERATE_ASYMMETRIC_KEY_PAIR.RESPONSE_TAG,
    constructTlv(
      GENERATE_ASYMMETRIC_KEY_PAIR.RESPONSE_ECC_POINT_TAG,
      publicKeyRawData
    )
  );
  mockCardReader.transmit.expectCallWith(command).resolves(responseData);
}

function mockCardCertStorageRequest(
  certObjectId: Buffer,
  certPath: string
): void {
  const command = new CardCommand({
    ins: PUT_DATA.INS,
    p1: PUT_DATA.P1,
    p2: PUT_DATA.P2,
    data: Buffer.concat([
      constructTlv(PUT_DATA.TAG_LIST_TAG, certObjectId),
      constructTlv(
        PUT_DATA.DATA_TAG,
        Buffer.concat([
          constructTlv(PUT_DATA.CERT_TAG, fs.readFileSync(certPath)),
          constructTlv(
            PUT_DATA.CERT_INFO_TAG,
            Buffer.of(PUT_DATA.CERT_INFO_UNCOMPRESSED)
          ),
          constructTlv(PUT_DATA.ERROR_DETECTION_CODE_TAG, Buffer.of()),
        ])
      ),
    ]),
  });
  const responseData = Buffer.of();
  mockCardReader.transmit.expectCallWith(command).resolves(responseData);
}

function mockCardGetDataRequest(
  dataObjectId: Buffer,
  dataOrError: Buffer | Error
): void {
  const command = new CardCommand({
    ins: GET_DATA.INS,
    p1: GET_DATA.P1,
    p2: GET_DATA.P2,
    data: constructTlv(GET_DATA.TAG_LIST_TAG, dataObjectId),
  });
  if (dataOrError instanceof Error) {
    mockCardReader.transmit.expectCallWith(command).throws(dataOrError);
    return;
  }
  const responseData = constructTlv(PUT_DATA.DATA_TAG, dataOrError);
  mockCardReader.transmit.expectCallWith(command).resolves(responseData);
}

function mockCardPutDataRequest(dataObjectId: Buffer, data: Buffer): void {
  const command = new CardCommand({
    ins: PUT_DATA.INS,
    p1: PUT_DATA.P1,
    p2: PUT_DATA.P2,
    data: Buffer.concat([
      constructTlv(PUT_DATA.TAG_LIST_TAG, dataObjectId),
      constructTlv(PUT_DATA.DATA_TAG, data),
    ]),
  });
  const responseData = Buffer.of();
  mockCardReader.transmit.expectCallWith(command).resolves(responseData);
}

test('Non-ready card statuses', async () => {
  const javaCard = new JavaCard(mockLogger(), {
    generateChallengeOverride,
    vxCertAuthorityCertPath: getTestFilePath({
      fileType: 'vx-cert-authority-cert.pem',
    }),
  });

  expect(await javaCard.getCardStatus()).toEqual({ status: 'no_card_reader' });

  mockCardReader.setReaderStatus('no_card');
  expect(await javaCard.getCardStatus()).toEqual({ status: 'no_card' });

  mockCardReader.setReaderStatus('card_error');
  expect(await javaCard.getCardStatus()).toEqual({ status: 'card_error' });

  mockCardReader.setReaderStatus('unknown_error');
  expect(await javaCard.getCardStatus()).toEqual({ status: 'unknown_error' });

  mockCardReader.setReaderStatus('no_card_reader');
  expect(await javaCard.getCardStatus()).toEqual({ status: 'no_card_reader' });
});

test.each<{
  description: string;
  cardType: CardType;
  vxCertAuthorityCert: TestFileSetId;
  cardVxCert: TestFileSetId;
  cardIdentityCert?: TestFileSetId;
  vxAdminCertAuthorityCert?: TestFileSetId;
  cardVxPrivateKey?: TestFileSetId;
  cardIdentityPrivateKey?: TestFileSetId;
  numRemainingPinAttempts?: number | Error;
  isCardIdentityCertRetrievalRequestExpected: boolean;
  isVxAdminCertAuthorityCertRetrievalRequestExpected: boolean;
  isCardVxPrivateKeySignatureRequestExpected: boolean;
  isCardIdentityPrivateKeySignatureRequestExpected: boolean;
  isCardGetNumRemainingPinAttemptsRequestExpected: boolean;
  expectedCardDetails?: CardDetails;
}>([
  {
    description: 'vendor card happy path',
    cardType: 'vendor',
    vxCertAuthorityCert: '1',
    cardVxCert: '1',
    cardIdentityCert: '1',
    vxAdminCertAuthorityCert: '1',
    cardVxPrivateKey: '1',
    numRemainingPinAttempts: MAX_NUM_INCORRECT_PIN_ATTEMPTS,
    isCardIdentityCertRetrievalRequestExpected: true,
    isVxAdminCertAuthorityCertRetrievalRequestExpected: false,
    isCardVxPrivateKeySignatureRequestExpected: true,
    isCardIdentityPrivateKeySignatureRequestExpected: false,
    isCardGetNumRemainingPinAttemptsRequestExpected: true,
    expectedCardDetails: {
      user: vendorUser,
    },
  },
  {
    description: 'system administrator card happy path',
    cardType: 'system-administrator',
    vxCertAuthorityCert: '1',
    cardVxCert: '1',
    cardIdentityCert: '1',
    vxAdminCertAuthorityCert: '1',
    cardVxPrivateKey: '1',
    numRemainingPinAttempts: MAX_NUM_INCORRECT_PIN_ATTEMPTS,
    isCardIdentityCertRetrievalRequestExpected: true,
    isVxAdminCertAuthorityCertRetrievalRequestExpected: true,
    isCardVxPrivateKeySignatureRequestExpected: true,
    isCardIdentityPrivateKeySignatureRequestExpected: false,
    isCardGetNumRemainingPinAttemptsRequestExpected: true,
    expectedCardDetails: {
      user: systemAdministratorUser,
    },
  },
  {
    description: 'election manager card happy path',
    cardType: 'election-manager',
    vxCertAuthorityCert: '1',
    cardVxCert: '1',
    cardIdentityCert: '1',
    vxAdminCertAuthorityCert: '1',
    cardVxPrivateKey: '1',
    numRemainingPinAttempts: MAX_NUM_INCORRECT_PIN_ATTEMPTS,
    isCardIdentityCertRetrievalRequestExpected: true,
    isVxAdminCertAuthorityCertRetrievalRequestExpected: true,
    isCardVxPrivateKeySignatureRequestExpected: true,
    isCardIdentityPrivateKeySignatureRequestExpected: false,
    isCardGetNumRemainingPinAttemptsRequestExpected: true,
    expectedCardDetails: {
      user: electionManagerUser,
    },
  },
  {
    description: 'poll worker card happy path',
    cardType: 'poll-worker',
    vxCertAuthorityCert: '1',
    cardVxCert: '1',
    cardIdentityCert: '1',
    vxAdminCertAuthorityCert: '1',
    cardVxPrivateKey: '1',
    cardIdentityPrivateKey: '1',
    isCardIdentityCertRetrievalRequestExpected: true,
    isVxAdminCertAuthorityCertRetrievalRequestExpected: true,
    isCardVxPrivateKeySignatureRequestExpected: true,
    isCardIdentityPrivateKeySignatureRequestExpected: true,
    isCardGetNumRemainingPinAttemptsRequestExpected: false,
    expectedCardDetails: {
      user: pollWorkerUser,
      hasPin: false,
    },
  },
  {
    description: 'poll worker card with PIN happy path',
    cardType: 'poll-worker-with-pin',
    vxCertAuthorityCert: '1',
    cardVxCert: '1',
    cardIdentityCert: '1',
    vxAdminCertAuthorityCert: '1',
    cardVxPrivateKey: '1',
    cardIdentityPrivateKey: '1',
    numRemainingPinAttempts: MAX_NUM_INCORRECT_PIN_ATTEMPTS,
    isCardIdentityCertRetrievalRequestExpected: true,
    isVxAdminCertAuthorityCertRetrievalRequestExpected: true,
    isCardVxPrivateKeySignatureRequestExpected: true,
    isCardIdentityPrivateKeySignatureRequestExpected: false,
    isCardGetNumRemainingPinAttemptsRequestExpected: true,
    expectedCardDetails: {
      user: pollWorkerUser,
      hasPin: true,
    },
  },
  {
    description: 'card VotingWorks cert was not signed by VotingWorks',
    cardType: 'poll-worker',
    vxCertAuthorityCert: '1',
    cardVxCert: '2',
    isCardIdentityCertRetrievalRequestExpected: false,
    isVxAdminCertAuthorityCertRetrievalRequestExpected: false,
    isCardVxPrivateKeySignatureRequestExpected: false,
    isCardIdentityPrivateKeySignatureRequestExpected: false,
    isCardGetNumRemainingPinAttemptsRequestExpected: false,
    expectedCardDetails: undefined,
  },
  {
    description: 'vendor card identity cert was not signed by VotingWorks',
    cardType: 'vendor',
    vxCertAuthorityCert: '1',
    cardVxCert: '1',
    cardIdentityCert: '2',
    isCardIdentityCertRetrievalRequestExpected: true,
    isVxAdminCertAuthorityCertRetrievalRequestExpected: false,
    isCardVxPrivateKeySignatureRequestExpected: false,
    isCardIdentityPrivateKeySignatureRequestExpected: false,
    isCardGetNumRemainingPinAttemptsRequestExpected: false,
    expectedCardDetails: undefined,
  },
  {
    description: 'non-vendor card identity cert was not signed by VxAdmin',
    cardType: 'poll-worker',
    vxCertAuthorityCert: '1',
    cardVxCert: '1',
    cardIdentityCert: '2',
    vxAdminCertAuthorityCert: '1',
    isCardIdentityCertRetrievalRequestExpected: true,
    isVxAdminCertAuthorityCertRetrievalRequestExpected: true,
    isCardVxPrivateKeySignatureRequestExpected: false,
    isCardIdentityPrivateKeySignatureRequestExpected: false,
    isCardGetNumRemainingPinAttemptsRequestExpected: false,
    expectedCardDetails: undefined,
  },
  {
    description: 'VxAdmin cert authority cert was not signed by VotingWorks',
    cardType: 'poll-worker',
    vxCertAuthorityCert: '1',
    cardVxCert: '1',
    cardIdentityCert: '2',
    vxAdminCertAuthorityCert: '2',
    isCardIdentityCertRetrievalRequestExpected: true,
    isVxAdminCertAuthorityCertRetrievalRequestExpected: true,
    isCardVxPrivateKeySignatureRequestExpected: false,
    isCardIdentityPrivateKeySignatureRequestExpected: false,
    isCardGetNumRemainingPinAttemptsRequestExpected: false,
    expectedCardDetails: undefined,
  },
  {
    description:
      'card does not have a private key that corresponds to ' +
      'the public key in the card VotingWorks cert',
    cardType: 'poll-worker',
    vxCertAuthorityCert: '1',
    cardVxCert: '1',
    cardIdentityCert: '1',
    vxAdminCertAuthorityCert: '1',
    cardVxPrivateKey: '2',
    isCardIdentityCertRetrievalRequestExpected: true,
    isVxAdminCertAuthorityCertRetrievalRequestExpected: true,
    isCardVxPrivateKeySignatureRequestExpected: true,
    isCardIdentityPrivateKeySignatureRequestExpected: false,
    isCardGetNumRemainingPinAttemptsRequestExpected: false,
    expectedCardDetails: undefined,
  },
  {
    description:
      'card does not have a private key that corresponds to ' +
      'the public key in the card identity cert',
    cardType: 'poll-worker',
    vxCertAuthorityCert: '1',
    cardVxCert: '1',
    cardIdentityCert: '1',
    vxAdminCertAuthorityCert: '1',
    cardVxPrivateKey: '1',
    cardIdentityPrivateKey: '2',
    isCardIdentityCertRetrievalRequestExpected: true,
    isVxAdminCertAuthorityCertRetrievalRequestExpected: true,
    isCardVxPrivateKeySignatureRequestExpected: true,
    isCardIdentityPrivateKeySignatureRequestExpected: true,
    isCardGetNumRemainingPinAttemptsRequestExpected: false,
    expectedCardDetails: undefined,
  },
  {
    description: 'card with incorrect PIN attempts',
    cardType: 'election-manager',
    vxCertAuthorityCert: '1',
    cardVxCert: '1',
    cardIdentityCert: '1',
    vxAdminCertAuthorityCert: '1',
    cardVxPrivateKey: '1',
    numRemainingPinAttempts: MAX_NUM_INCORRECT_PIN_ATTEMPTS - 5,
    isCardIdentityCertRetrievalRequestExpected: true,
    isVxAdminCertAuthorityCertRetrievalRequestExpected: true,
    isCardVxPrivateKeySignatureRequestExpected: true,
    isCardIdentityPrivateKeySignatureRequestExpected: false,
    isCardGetNumRemainingPinAttemptsRequestExpected: true,
    expectedCardDetails: {
      numIncorrectPinAttempts: 5,
      user: electionManagerUser,
    },
  },
  {
    description: 'error retrieving num remaining PIN attempts',
    cardType: 'election-manager',
    vxCertAuthorityCert: '1',
    cardVxCert: '1',
    cardIdentityCert: '1',
    vxAdminCertAuthorityCert: '1',
    cardVxPrivateKey: '1',
    numRemainingPinAttempts: new Error('Whoa!'),
    isCardIdentityCertRetrievalRequestExpected: true,
    isVxAdminCertAuthorityCertRetrievalRequestExpected: true,
    isCardVxPrivateKeySignatureRequestExpected: true,
    isCardIdentityPrivateKeySignatureRequestExpected: false,
    isCardGetNumRemainingPinAttemptsRequestExpected: true,
    expectedCardDetails: undefined,
  },
])(
  'Reading card details - $description',
  async ({
    cardType,
    vxCertAuthorityCert,
    cardVxCert,
    cardIdentityCert,
    vxAdminCertAuthorityCert,
    cardVxPrivateKey,
    cardIdentityPrivateKey,
    numRemainingPinAttempts,
    isCardIdentityCertRetrievalRequestExpected,
    isVxAdminCertAuthorityCertRetrievalRequestExpected,
    isCardVxPrivateKeySignatureRequestExpected,
    isCardIdentityPrivateKeySignatureRequestExpected,
    isCardGetNumRemainingPinAttemptsRequestExpected,
    expectedCardDetails,
  }) => {
    const javaCard = new JavaCard(mockLogger(), {
      generateChallengeOverride,
      vxCertAuthorityCertPath: getTestFilePath({
        setId: vxCertAuthorityCert,
        fileType: 'vx-cert-authority-cert.pem',
      }),
    });

    mockCardAppletSelectionRequest();
    mockCardCertRetrievalRequest(
      CARD_VX_CERT.OBJECT_ID,
      getTestFilePath({
        setId: cardVxCert,
        fileType: 'card-vx-cert.der',
        cardType,
      })
    );
    if (isCardIdentityCertRetrievalRequestExpected) {
      assert(cardIdentityCert !== undefined);
      mockCardCertRetrievalRequest(
        CARD_IDENTITY_CERT.OBJECT_ID,
        getTestFilePath({
          setId: cardIdentityCert,
          fileType: 'card-identity-cert.der',
          cardType,
        })
      );
    }
    if (isVxAdminCertAuthorityCertRetrievalRequestExpected) {
      assert(vxAdminCertAuthorityCert !== undefined);
      mockCardCertRetrievalRequest(
        VX_ADMIN_CERT_AUTHORITY_CERT.OBJECT_ID,
        getTestFilePath({
          setId: vxAdminCertAuthorityCert,
          fileType: 'vx-admin-cert-authority-cert.der',
        })
      );
    }
    if (isCardVxPrivateKeySignatureRequestExpected) {
      assert(cardVxPrivateKey !== undefined);
      await mockCardSignatureRequest(
        CARD_VX_CERT.PRIVATE_KEY_ID,
        getTestFilePath({
          setId: cardVxPrivateKey,
          fileType: 'card-vx-private-key.pem',
          cardType,
        })
      );
    }
    if (isCardIdentityPrivateKeySignatureRequestExpected) {
      assert(cardIdentityPrivateKey !== undefined);
      mockCardPinVerificationRequest(DEFAULT_PIN);
      await mockCardSignatureRequest(
        CARD_IDENTITY_CERT.PRIVATE_KEY_ID,
        getTestFilePath({
          setId: cardIdentityPrivateKey,
          fileType: 'card-identity-private-key.pem',
          cardType,
        })
      );
    }
    if (isCardGetNumRemainingPinAttemptsRequestExpected) {
      assert(numRemainingPinAttempts !== undefined);
      mockCardGetNumRemainingPinAttemptsRequest(numRemainingPinAttempts);
    }

    mockCardReader.setReaderStatus('ready');
    await waitForExpect(async () => {
      // This might fail if the test keys and certs are outdated (e.g. if the election key changes).
      // Run ./scripts/generate-test-keys-and-certs to update them.
      expect(await javaCard.getCardStatus()).toEqual({
        status: 'ready',
        cardDetails: expectedCardDetails,
      });
    });
  }
);

test.each<{
  description: string;
  cardPinVerificationRequestError?: Error;
  cardSignatureRequestError?: Error;
  expectedResponse?: CheckPinResponse | Error;
}>([
  {
    description: 'correct PIN',
    expectedResponse: { response: 'correct' },
  },
  {
    description: 'incorrect PIN',
    cardPinVerificationRequestError: new ResponseApduError([
      STATUS_WORD.VERIFY_FAIL.SW1,
      0xc5,
    ]),
    expectedResponse: { response: 'incorrect', numIncorrectPinAttempts: 10 },
  },
  {
    description: 'unexpected PIN verification request error',
    cardPinVerificationRequestError: new Error('Whoa!'),
    expectedResponse: new Error('Whoa!'),
  },
  {
    description: 'unexpected signature request error',
    cardSignatureRequestError: new Error('Whoa!'),
    expectedResponse: new Error('Whoa!'),
  },
])(
  'Checking PIN - $description',
  async ({
    cardPinVerificationRequestError,
    cardSignatureRequestError,
    expectedResponse,
  }) => {
    const javaCard = new TestJavaCard(mockLogger(), config);
    javaCard.setCardStatus({
      status: 'ready',
      cardDetails: {
        user: electionManagerUser,
      },
    });

    mockCardAppletSelectionRequest();
    mockCardCertRetrievalRequest(
      CARD_IDENTITY_CERT.OBJECT_ID,
      getTestFilePath({
        fileType: 'card-identity-cert.der',
        cardType: 'system-administrator',
      })
    );
    mockCardPinVerificationRequest('123456', cardPinVerificationRequestError);
    if (!cardPinVerificationRequestError) {
      await mockCardSignatureRequest(
        CARD_IDENTITY_CERT.PRIVATE_KEY_ID,
        getTestFilePath({
          fileType: 'card-identity-private-key.pem',
          cardType: 'system-administrator',
        }),
        cardSignatureRequestError
      );
    }

    if (expectedResponse instanceof Error) {
      await expect(javaCard.checkPin('123456')).rejects.toThrow(
        expectedResponse
      );
    } else {
      expect(await javaCard.checkPin('123456')).toEqual(expectedResponse);
    }
  }
);

test.each<{
  description: string;
  config: JavaCardConfig;
  programInput: Parameters<ProgrammableCard['program']>[0];
  expectedCardType: CardType;
  expectedCertSubject: string;
  expectedExpiryInDays: number;
  expectedSigningCertAuthorityCertPath: string;
  expectedSigningPrivateKeyPath: string;
  isVxAdminCertAuthorityCertRetrievalRequestExpected: boolean;
  expectedCardDetailsAfterProgramming: CardDetails;
}>([
  {
    description: 'vendor card',
    config: configWithVxCardProgrammingConfig,
    programInput: {
      user: vendorUser,
      pin: '123456',
    },
    expectedCardType: 'vendor',
    expectedCertSubject:
      '/C=US/ST=CA/O=VotingWorks' +
      '/1.3.6.1.4.1.59817.1=card' +
      `/1.3.6.1.4.1.59817.2=${TEST_JURISDICTION}` +
      '/1.3.6.1.4.1.59817.3=vendor/',
    expectedExpiryInDays: 7,
    expectedSigningCertAuthorityCertPath: getTestFilePath({
      fileType: 'vx-cert-authority-cert.pem',
    }),
    expectedSigningPrivateKeyPath: getTestFilePath({
      fileType: 'vx-private-key.pem',
    }),
    isVxAdminCertAuthorityCertRetrievalRequestExpected: false,
    expectedCardDetailsAfterProgramming: {
      user: vendorUser,
    },
  },
  {
    description: 'system administrator card',
    config: configWithVxAdminCardProgrammingConfig,
    programInput: {
      user: systemAdministratorUser,
      pin: '123456',
    },
    expectedCardType: 'system-administrator',
    expectedCertSubject:
      '/C=US/ST=CA/O=VotingWorks' +
      '/1.3.6.1.4.1.59817.1=card' +
      `/1.3.6.1.4.1.59817.2=${TEST_JURISDICTION}` +
      '/1.3.6.1.4.1.59817.3=system-administrator/',
    expectedExpiryInDays: 365 * 5,
    expectedSigningCertAuthorityCertPath: getTestFilePath({
      fileType: 'vx-admin-cert-authority-cert.pem',
    }),
    expectedSigningPrivateKeyPath: getTestFilePath({
      fileType: 'vx-admin-private-key.pem',
    }),
    isVxAdminCertAuthorityCertRetrievalRequestExpected: true,
    expectedCardDetailsAfterProgramming: {
      user: systemAdministratorUser,
    },
  },
  {
    description: 'election manager card',
    config: configWithVxAdminCardProgrammingConfig,
    programInput: {
      user: electionManagerUser,
      pin: '123456',
    },
    expectedCardType: 'election-manager',
    expectedCertSubject:
      '/C=US/ST=CA/O=VotingWorks' +
      '/1.3.6.1.4.1.59817.1=card' +
      `/1.3.6.1.4.1.59817.2=${TEST_JURISDICTION}` +
      '/1.3.6.1.4.1.59817.3=election-manager' +
      `/1.3.6.1.4.1.59817.4=${electionKey.id}` +
      `/1.3.6.1.4.1.59817.5=${electionKey.date.toISOString()}/`,
    expectedExpiryInDays: Math.round(365 * 0.5),
    expectedSigningCertAuthorityCertPath: getTestFilePath({
      fileType: 'vx-admin-cert-authority-cert.pem',
    }),
    expectedSigningPrivateKeyPath: getTestFilePath({
      fileType: 'vx-admin-private-key.pem',
    }),
    isVxAdminCertAuthorityCertRetrievalRequestExpected: true,
    expectedCardDetailsAfterProgramming: {
      user: electionManagerUser,
    },
  },
  {
    description: 'poll worker card',
    config: configWithVxAdminCardProgrammingConfig,
    programInput: {
      user: pollWorkerUser,
    },
    expectedCardType: 'poll-worker',
    expectedCertSubject:
      '/C=US/ST=CA/O=VotingWorks' +
      '/1.3.6.1.4.1.59817.1=card' +
      `/1.3.6.1.4.1.59817.2=${TEST_JURISDICTION}` +
      '/1.3.6.1.4.1.59817.3=poll-worker' +
      `/1.3.6.1.4.1.59817.4=${electionKey.id}` +
      `/1.3.6.1.4.1.59817.5=${electionKey.date.toISOString()}/`,
    expectedExpiryInDays: Math.round(365 * 0.5),
    expectedSigningCertAuthorityCertPath: getTestFilePath({
      fileType: 'vx-admin-cert-authority-cert.pem',
    }),
    expectedSigningPrivateKeyPath: getTestFilePath({
      fileType: 'vx-admin-private-key.pem',
    }),
    isVxAdminCertAuthorityCertRetrievalRequestExpected: true,
    expectedCardDetailsAfterProgramming: {
      user: pollWorkerUser,
      hasPin: false,
    },
  },
  {
    description: 'poll worker card with PIN',
    config: configWithVxAdminCardProgrammingConfig,
    programInput: {
      user: pollWorkerUser,
      pin: '123456',
    },
    expectedCardType: 'poll-worker-with-pin',
    expectedCertSubject:
      '/C=US/ST=CA/O=VotingWorks' +
      '/1.3.6.1.4.1.59817.1=card' +
      `/1.3.6.1.4.1.59817.2=${TEST_JURISDICTION}` +
      '/1.3.6.1.4.1.59817.3=poll-worker-with-pin' +
      `/1.3.6.1.4.1.59817.4=${electionKey.id}` +
      `/1.3.6.1.4.1.59817.5=${electionKey.date.toISOString()}/`,
    expectedExpiryInDays: Math.round(365 * 0.5),
    expectedSigningCertAuthorityCertPath: getTestFilePath({
      fileType: 'vx-admin-cert-authority-cert.pem',
    }),
    expectedSigningPrivateKeyPath: getTestFilePath({
      fileType: 'vx-admin-private-key.pem',
    }),
    isVxAdminCertAuthorityCertRetrievalRequestExpected: true,
    expectedCardDetailsAfterProgramming: {
      user: pollWorkerUser,
      hasPin: true,
    },
  },
])(
  'Programming - $description',
  async ({
    config: configToUse,
    programInput,
    expectedCardType,
    expectedCertSubject,
    expectedExpiryInDays,
    expectedSigningCertAuthorityCertPath,
    expectedSigningPrivateKeyPath,
    isVxAdminCertAuthorityCertRetrievalRequestExpected,
    expectedCardDetailsAfterProgramming,
  }) => {
    const javaCard = new JavaCard(mockLogger(), configToUse);

    const pin = ('pin' in programInput && programInput.pin) || DEFAULT_PIN;
    mockCardAppletSelectionRequest();
    mockCardPinResetRequest(pin);
    mockCardPinVerificationRequest(pin);
    mockCardKeyPairGenerationRequest(
      CARD_IDENTITY_CERT.PRIVATE_KEY_ID,
      getTestFilePath({
        fileType: 'card-identity-public-key.der',
        cardType: expectedCardType,
      })
    );
    const cardIdentityCertPath = getTestFilePath({
      fileType: 'card-identity-cert.der',
      cardType: expectedCardType,
    });
    mockOf(createCert).mockImplementationOnce(() =>
      certDerToPem(fs.readFileSync(cardIdentityCertPath))
    );
    mockCardCertStorageRequest(
      CARD_IDENTITY_CERT.OBJECT_ID,
      cardIdentityCertPath
    );
    if (isVxAdminCertAuthorityCertRetrievalRequestExpected) {
      mockCardCertStorageRequest(
        VX_ADMIN_CERT_AUTHORITY_CERT.OBJECT_ID,
        getTestFilePath({
          fileType: 'vx-admin-cert-authority-cert.der',
        })
      );
    }

    await javaCard.program(programInput);
    expect(createCert).toHaveBeenCalledTimes(1);
    expect(createCert).toHaveBeenNthCalledWith(1, {
      certKeyInput: {
        type: 'public',
        key: {
          source: 'inline',
          content: (
            await publicKeyDerToPem(
              fs.readFileSync(
                getTestFilePath({
                  fileType: 'card-identity-public-key.der',
                  cardType: expectedCardType,
                })
              )
            )
          ).toString('utf-8'),
        },
      },
      certSubject: expectedCertSubject,
      expiryInDays: expectedExpiryInDays,
      signingCertAuthorityCertPath: expectedSigningCertAuthorityCertPath,
      signingPrivateKey: {
        source: 'file',
        path: expectedSigningPrivateKeyPath,
      },
    });

    expect(await javaCard.getCardStatus()).toEqual({
      status: 'ready',
      cardDetails: expectedCardDetailsAfterProgramming,
    });
  }
);

test('Unprogramming', async () => {
  const javaCard = new JavaCard(
    mockLogger(),
    configWithVxAdminCardProgrammingConfig
  );

  mockCardAppletSelectionRequest();
  mockCardPinResetRequest(DEFAULT_PIN);
  mockCardPutDataRequest(CARD_IDENTITY_CERT.OBJECT_ID, Buffer.of());
  mockCardPutDataRequest(VX_ADMIN_CERT_AUTHORITY_CERT.OBJECT_ID, Buffer.of());
  mockCardAppletSelectionRequest();
  for (const objectId of GENERIC_STORAGE_SPACE.OBJECT_IDS) {
    mockCardPutDataRequest(objectId, Buffer.of());
  }

  await javaCard.unprogram();

  expect(await javaCard.getCardStatus()).toEqual({
    status: 'ready',
    cardDetails: undefined,
  });
});

test('Attempting programming and unprogramming when cardProgrammingConfig is undefined', async () => {
  const javaCard = new JavaCard(mockLogger(), config);

  await expect(
    javaCard.program({ user: systemAdministratorUser, pin: '123456' })
  ).rejects.toThrow('cardProgrammingConfig must be defined');
  await expect(javaCard.unprogram()).rejects.toThrow(
    'cardProgrammingConfig must be defined'
  );
});

test('Data reading', async () => {
  const javaCard = new JavaCard(mockLogger(), config);

  mockCardAppletSelectionRequest();
  mockCardGetDataRequest(
    GENERIC_STORAGE_SPACE.OBJECT_IDS[0],
    Buffer.concat([Buffer.alloc(25000, 1), Buffer.alloc(7763, 2)])
  );
  mockCardGetDataRequest(
    GENERIC_STORAGE_SPACE.OBJECT_IDS[1],
    Buffer.alloc(17237, 2)
  );
  mockCardGetDataRequest(
    GENERIC_STORAGE_SPACE.OBJECT_IDS[2],
    new ResponseApduError([
      STATUS_WORD.FILE_NOT_FOUND.SW1,
      STATUS_WORD.FILE_NOT_FOUND.SW2,
    ])
  );

  expect(await javaCard.readData()).toEqual(
    Buffer.concat([Buffer.alloc(25000, 1), Buffer.alloc(25000, 2)])
  );
});

test.each<{
  data: Buffer;
  expectedPutDataRequests: Array<{ dataObjectId: Buffer; data: Buffer }>;
}>([
  {
    data: Buffer.concat([
      Buffer.alloc(25000, 1),
      Buffer.alloc(25000, 2),
      Buffer.alloc(25000, 3),
    ]),
    expectedPutDataRequests: [
      {
        dataObjectId: GENERIC_STORAGE_SPACE.OBJECT_IDS[0],
        data: Buffer.concat([Buffer.alloc(25000, 1), Buffer.alloc(7763, 2)]),
      },
      {
        dataObjectId: GENERIC_STORAGE_SPACE.OBJECT_IDS[1],
        data: Buffer.concat([Buffer.alloc(17237, 2), Buffer.alloc(15526, 3)]),
      },
      {
        dataObjectId: GENERIC_STORAGE_SPACE.OBJECT_IDS[2],
        data: Buffer.alloc(9474, 3),
      },
    ],
  },
  {
    data: Buffer.alloc(25000, 1),
    expectedPutDataRequests: [
      {
        dataObjectId: GENERIC_STORAGE_SPACE.OBJECT_IDS[0],
        data: Buffer.alloc(25000, 1),
      },
      {
        dataObjectId: GENERIC_STORAGE_SPACE.OBJECT_IDS[1],
        data: Buffer.of(),
      },
      {
        dataObjectId: GENERIC_STORAGE_SPACE.OBJECT_IDS[2],
        data: Buffer.of(),
      },
    ],
  },
])('Data writing', async ({ data, expectedPutDataRequests }) => {
  const javaCard = new JavaCard(mockLogger(), config);

  mockCardAppletSelectionRequest();
  for (const request of expectedPutDataRequests) {
    mockCardPutDataRequest(request.dataObjectId, request.data);
  }

  await javaCard.writeData(data);
});

test('Data clearing', async () => {
  const javaCard = new JavaCard(mockLogger(), config);

  mockCardAppletSelectionRequest();
  for (const dataObjectId of GENERIC_STORAGE_SPACE.OBJECT_IDS) {
    mockCardPutDataRequest(dataObjectId, Buffer.of());
  }

  await javaCard.clearData();
});

test('Data reading error handling', async () => {
  const javaCard = new JavaCard(mockLogger(), config);

  mockCardAppletSelectionRequest();
  mockCardGetDataRequest(
    GENERIC_STORAGE_SPACE.OBJECT_IDS[0],
    Buffer.alloc(25000, 1)
  );
  mockCardGetDataRequest(
    GENERIC_STORAGE_SPACE.OBJECT_IDS[1],
    new Error('Whoa!')
  );

  await expect(javaCard.readData()).rejects.toThrow('Whoa!');
});

test('Attempting to write too much data', async () => {
  const javaCard = new JavaCard(mockLogger(), config);

  const data = Buffer.alloc(GENERIC_STORAGE_SPACE_CAPACITY_BYTES + 1);
  await expect(javaCard.writeData(data)).rejects.toThrow(
    'Not enough space on card'
  );
});

//
// Methods for scripts
//

test('disconnect', async () => {
  const javaCard = new JavaCard(mockLogger(), config);

  mockCardReader.disconnectCard.expectCallWith().resolves();

  await javaCard.disconnect();
});

test('retrieveCertByIdentifier', async () => {
  const javaCard = new JavaCard(mockLogger(), config);

  mockCardAppletSelectionRequest();
  mockCardCertRetrievalRequest(
    CARD_VX_CERT.OBJECT_ID,
    getTestFilePath({
      fileType: 'card-vx-cert.der',
      cardType: 'system-administrator',
    })
  );

  await javaCard.retrieveCertByIdentifier('cardVxCert');
});

test('createAndStoreCardVxCert', async () => {
  const javaCard = new JavaCard(
    mockLogger(),
    configWithVxCardProgrammingConfig
  );

  mockCardAppletSelectionRequest();
  mockCardKeyPairGenerationRequest(
    CARD_VX_CERT.PRIVATE_KEY_ID,
    getTestFilePath({
      fileType: 'card-vx-public-key.der',
      cardType: 'system-administrator',
    })
  );
  const cardVxCertPath = getTestFilePath({
    fileType: 'card-vx-cert.der',
    cardType: 'system-administrator',
  });
  mockOf(createCert).mockImplementationOnce(() =>
    certDerToPem(fs.readFileSync(cardVxCertPath))
  );
  mockCardCertStorageRequest(CARD_VX_CERT.OBJECT_ID, cardVxCertPath);

  await javaCard.createAndStoreCardVxCert();
  expect(createCert).toHaveBeenCalledTimes(1);
  expect(createCert).toHaveBeenNthCalledWith(1, {
    certKeyInput: {
      type: 'public',
      key: {
        source: 'inline',
        content: (
          await publicKeyDerToPem(
            fs.readFileSync(
              getTestFilePath({
                fileType: 'card-vx-public-key.der',
                cardType: 'system-administrator',
              })
            )
          )
        ).toString('utf-8'),
      },
    },
    certSubject: '/C=US/ST=CA/O=VotingWorks/1.3.6.1.4.1.59817.1=card/',
    expiryInDays: 365 * 100,
    signingCertAuthorityCertPath: getTestFilePath({
      fileType: 'vx-cert-authority-cert.pem',
    }),
    signingPrivateKey: {
      source: 'file',
      path: getTestFilePath({
        fileType: 'vx-private-key.pem',
      }),
    },
  });
});
