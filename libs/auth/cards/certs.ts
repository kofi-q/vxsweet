import { Buffer } from 'node:buffer';
import { z } from 'zod';
import { assert, throwIllegalValue } from '@vx/libs/basics/assert';
import { DateWithoutTime } from '@vx/libs/basics/time';
import { type ElectionId, type ElectionKey } from '@vx/libs/types/elections';
import { arePollWorkerCardDetails, type CardDetails } from './card';
import { openssl } from '../cryptography/cryptography';

/**
 * VotingWorks's IANA-assigned enterprise OID
 */
const VX_IANA_ENTERPRISE_OID = '1.3.6.1.4.1.59817';

/**
 * Instead of overloading existing X.509 cert fields, we're using our own custom cert fields.
 */
const VX_CUSTOM_CERT_FIELD = {
  /**
   * One of: admin, central-scan, mark, mark-scan, scan, card (the first five referring to
   * machines)
   */
  COMPONENT: `${VX_IANA_ENTERPRISE_OID}.1`,
  /** Format: {state-2-letter-abbreviation}.{county-or-town} (e.g. ms.warren or ca.los-angeles) */
  JURISDICTION: `${VX_IANA_ENTERPRISE_OID}.2`,
  /** One of: vendor, system-administrator, election-manager, poll-worker, poll-worker-with-pin */
  CARD_TYPE: `${VX_IANA_ENTERPRISE_OID}.3`,
  /** The election id from the {@link ElectionKey} */
  ELECTION_ID: `${VX_IANA_ENTERPRISE_OID}.4`,
  /** The election date from the {@link ElectionKey} */
  ELECTION_DATE: `${VX_IANA_ENTERPRISE_OID}.5`,
} as const;

/**
 * Standard X.509 cert fields, common across all VotingWorks certs
 */
export const STANDARD_CERT_FIELDS = [
  'C=US', // Country
  'ST=CA', // State
  'O=VotingWorks', // Organization
] as const;

interface VxAdminCustomCertFields {
  component: 'admin';
  jurisdiction: string;
}

interface VxCentralScanCustomCertFields {
  component: 'central-scan';
}

interface VxMarkCustomCertFields {
  component: 'mark';
}

interface VxMarkScanCustomCertFields {
  component: 'mark-scan';
}

interface VxScanCustomCertFields {
  component: 'scan';
}

interface VendorCardCustomCertFields {
  component: 'card';
  jurisdiction: string;
  cardType: 'vendor';
}

interface SystemAdministratorCardCustomCertFields {
  component: 'card';
  jurisdiction: string;
  cardType: 'system-administrator';
}

interface ElectionCardCustomCertFields {
  component: 'card';
  jurisdiction: string;
  cardType: 'election-manager' | 'poll-worker' | 'poll-worker-with-pin';
  electionId: string;
  electionDate: string;
}

type CardCustomCertFields =
  | VendorCardCustomCertFields
  | SystemAdministratorCardCustomCertFields
  | ElectionCardCustomCertFields;

/**
 * Parsed custom cert fields
 */
export type CustomCertFields =
  | VxAdminCustomCertFields
  | VxCentralScanCustomCertFields
  | VxMarkCustomCertFields
  | VxMarkScanCustomCertFields
  | VxScanCustomCertFields
  | CardCustomCertFields;

/**
 * Valid values for component field in VotingWorks certs
 */
export type Component = CustomCertFields['component'];

/**
 * Machine type as specified in VotingWorks certs
 */
export type MachineType = Exclude<Component, 'card'>;

/**
 * Valid values for card type field in VotingWorks certs
 */
export type CardType = CardCustomCertFields['cardType'];

const VxAdminCustomCertFieldsSchema: z.ZodSchema<VxAdminCustomCertFields> =
  z.object({
    component: z.literal('admin'),
    jurisdiction: z.string(),
  });

const VxCentralScanCustomCertFieldsSchema: z.ZodSchema<VxCentralScanCustomCertFields> =
  z.object({
    component: z.literal('central-scan'),
  });

const VxMarkCustomCertFieldsSchema: z.ZodSchema<VxMarkCustomCertFields> =
  z.object({
    component: z.literal('mark'),
  });

const VxMarkScanCustomCertFieldsSchema: z.ZodSchema<VxMarkScanCustomCertFields> =
  z.object({
    component: z.literal('mark-scan'),
  });

const VxScanCustomCertFieldsSchema: z.ZodSchema<VxScanCustomCertFields> =
  z.object({
    component: z.literal('scan'),
  });

const VendorCardCustomCertFieldsSchema: z.ZodSchema<VendorCardCustomCertFields> =
  z.object({
    component: z.literal('card'),
    jurisdiction: z.string(),
    cardType: z.literal('vendor'),
  });

const SystemAdministratorCardCustomCertFieldsSchema: z.ZodSchema<SystemAdministratorCardCustomCertFields> =
  z.object({
    component: z.literal('card'),
    jurisdiction: z.string(),
    cardType: z.literal('system-administrator'),
  });

const ElectionCardCustomCertFieldsSchema: z.ZodSchema<ElectionCardCustomCertFields> =
  z.object({
    component: z.literal('card'),
    jurisdiction: z.string(),
    cardType: z.union([
      z.literal('election-manager'),
      z.literal('poll-worker'),
      z.literal('poll-worker-with-pin'),
    ]),
    electionId: z.string(),
    electionDate: z.string(),
  });

const CardCustomCertFieldsSchema: z.ZodSchema<CardCustomCertFields> = z.union([
  VendorCardCustomCertFieldsSchema,
  SystemAdministratorCardCustomCertFieldsSchema,
  ElectionCardCustomCertFieldsSchema,
]);

/**
 * A schema to facilitate parsing custom cert fields
 */
const CustomCertFieldsSchema: z.ZodSchema<CustomCertFields> = z.union([
  VxAdminCustomCertFieldsSchema,
  VxCentralScanCustomCertFieldsSchema,
  VxMarkCustomCertFieldsSchema,
  VxMarkScanCustomCertFieldsSchema,
  VxScanCustomCertFieldsSchema,
  CardCustomCertFieldsSchema,
]);

/**
 * Cert expiries in days. Must be integers.
 */
export const CERT_EXPIRY_IN_DAYS = {
  MACHINE_VX_CERT: 365 * 100, // 100 years
  CARD_VX_CERT: 365 * 100, // 100 years
  VENDOR_CARD_IDENTITY_CERT: 7, // 1 week
  SYSTEM_ADMINISTRATOR_CARD_IDENTITY_CERT: 365 * 5, // 5 years
  ELECTION_CARD_IDENTITY_CERT: Math.round(365 * 0.5), // 6 months

  /** Used by dev/test cert-generation scripts */
  DEV: 365 * 100, // 100 years
} as const;

/**
 * Parses the provided cert and returns the custom cert fields. Throws an error if the cert doesn't
 * follow VotingWorks's cert format.
 */
export async function parseCert(cert: Buffer): Promise<CustomCertFields> {
  const response = await openssl(['x509', '-noout', '-subject', '-in', cert]);

  const responseString = response.toString('utf-8');
  assert(responseString.startsWith('subject='));
  const certSubject = responseString.replace('subject=', '').trimEnd();

  const certFieldsList = certSubject
    .split(',')
    .map((field) => field.trimStart());
  const certFields: { [fieldName: string]: string } = {};
  for (const certField of certFieldsList) {
    const [fieldName, fieldValue] = certField.split(' = ');
    if (fieldName && fieldValue) {
      certFields[fieldName] = fieldValue;
    }
  }

  const certDetails = CustomCertFieldsSchema.parse({
    component: certFields[VX_CUSTOM_CERT_FIELD.COMPONENT],
    jurisdiction: certFields[VX_CUSTOM_CERT_FIELD.JURISDICTION],
    cardType: certFields[VX_CUSTOM_CERT_FIELD.CARD_TYPE],
    electionId: certFields[VX_CUSTOM_CERT_FIELD.ELECTION_ID],
    electionDate: certFields[VX_CUSTOM_CERT_FIELD.ELECTION_DATE],
  });

  return certDetails;
}

function createElectionKey(
  certDetails: ElectionCardCustomCertFields
): ElectionKey {
  const { electionId, electionDate } = certDetails;
  return {
    id: electionId as ElectionId,
    date: new DateWithoutTime(electionDate),
  };
}

/**
 * Parses the provided cert and returns card details. Throws an error if the cert doesn't follow
 * VotingWorks's card cert format.
 */
export async function parseCardDetailsFromCert(
  cert: Buffer
): Promise<CardDetails> {
  const certDetails = await parseCert(cert);
  assert(certDetails.component === 'card');
  const { jurisdiction, cardType } = certDetails;

  switch (cardType) {
    case 'vendor': {
      return {
        user: { role: 'vendor', jurisdiction },
      };
    }
    case 'system-administrator': {
      return {
        user: { role: 'system_administrator', jurisdiction },
      };
    }
    case 'election-manager': {
      return {
        user: {
          role: 'election_manager',
          jurisdiction,
          electionKey: createElectionKey(certDetails),
        },
      };
    }
    case 'poll-worker': {
      return {
        user: {
          role: 'poll_worker',
          jurisdiction,
          electionKey: createElectionKey(certDetails),
        },
        hasPin: false,
      };
    }
    case 'poll-worker-with-pin': {
      return {
        user: {
          role: 'poll_worker',
          jurisdiction,
          electionKey: createElectionKey(certDetails),
        },
        hasPin: true,
      };
    }
    /* istanbul ignore next: Compile-time check for completeness */
    default: {
      throwIllegalValue(cardType);
    }
  }
}

/**
 * Constructs a VotingWorks card cert subject that can be passed to an openssl command
 */
export function constructCardCertSubject(cardDetails: CardDetails): string {
  const { user } = cardDetails;
  const component: Component = 'card';

  let cardType: CardType;
  let electionKey: ElectionKey | undefined;
  switch (user.role) {
    case 'vendor': {
      cardType = 'vendor';
      break;
    }
    case 'system_administrator': {
      cardType = 'system-administrator';
      break;
    }
    case 'election_manager': {
      cardType = 'election-manager';
      electionKey = user.electionKey;
      break;
    }
    case 'poll_worker': {
      assert(arePollWorkerCardDetails(cardDetails));
      cardType = cardDetails.hasPin ? 'poll-worker-with-pin' : 'poll-worker';
      electionKey = user.electionKey;
      break;
    }
    /* istanbul ignore next: Compile-time check for completeness */
    default: {
      throwIllegalValue(user, 'role');
    }
  }

  const entries = [
    ...STANDARD_CERT_FIELDS,
    `${VX_CUSTOM_CERT_FIELD.COMPONENT}=${component}`,
    `${VX_CUSTOM_CERT_FIELD.JURISDICTION}=${user.jurisdiction}`,
    `${VX_CUSTOM_CERT_FIELD.CARD_TYPE}=${cardType}`,
  ];
  if (electionKey) {
    entries.push(`${VX_CUSTOM_CERT_FIELD.ELECTION_ID}=${electionKey.id}`);
    entries.push(
      `${VX_CUSTOM_CERT_FIELD.ELECTION_DATE}=${electionKey.date.toISOString()}`
    );
  }
  const certSubject = `/${entries.join('/')}/`;

  return certSubject;
}

/**
 * Constructs a VotingWorks card cert subject without a jurisdiction and card type, that can be
 * passed to an openssl command. This trimmed down cert subject is used in the card's
 * VotingWorks-issued cert. The card's VxAdmin-issued cert, on the other hand, requires
 * jurisdiction and card type.
 */
export function constructCardCertSubjectWithoutJurisdictionAndCardType(): string {
  const component: Component = 'card';
  const entries = [
    ...STANDARD_CERT_FIELDS,
    `${VX_CUSTOM_CERT_FIELD.COMPONENT}=${component}`,
  ];
  const certSubject = `/${entries.join('/')}/`;
  return certSubject;
}

/**
 * Constructs a VotingWorks machine cert subject that can be passed to an openssl command
 */
export function constructMachineCertSubject(
  machineType: MachineType,
  jurisdiction?: string
): string {
  assert(
    (machineType === 'admin' && jurisdiction !== undefined) ||
      (machineType !== 'admin' && jurisdiction === undefined)
  );
  const entries = [
    ...STANDARD_CERT_FIELDS,
    `${VX_CUSTOM_CERT_FIELD.COMPONENT}=${machineType}`,
  ];
  if (jurisdiction) {
    entries.push(`${VX_CUSTOM_CERT_FIELD.JURISDICTION}=${jurisdiction}`);
  }
  const certSubject = `/${entries.join('/')}/`;
  return certSubject;
}
