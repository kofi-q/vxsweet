import {
  type ElectionManagerUser,
  type SystemAdministratorUser,
  type UserWithCard,
  type VendorUser,
} from './auth';

export interface LoggedOut {
  readonly status: 'logged_out';
  readonly reason:
    | 'no_card_reader'
    | 'card_error'
    | 'invalid_user_on_card'
    | 'machine_locked'
    | 'machine_locked_by_session_expiry'
    | 'machine_not_configured'
    | 'user_role_not_allowed'
    | 'wrong_election'
    | 'wrong_jurisdiction';
  readonly cardJurisdiction?: string;
  readonly cardUserRole?: UserWithCard['role'];
  readonly machineJurisdiction?: string;
}

export interface CheckingPin {
  readonly status: 'checking_pin';
  readonly user: VendorUser | SystemAdministratorUser | ElectionManagerUser;
  readonly error?: { error: unknown; erroredAt: Date };
  readonly lockedOutUntil?: Date;
  readonly wrongPinEnteredAt?: Date;
}

export interface RemoveCard {
  readonly status: 'remove_card';
  readonly user: VendorUser | SystemAdministratorUser | ElectionManagerUser;
  readonly sessionExpiresAt: Date;
}

export interface ProgrammableCardReady {
  status: 'ready';
  programmedUser?: UserWithCard;
}

interface ProgrammableCardNotReady {
  status: 'card_error' | 'no_card_reader' | 'no_card' | 'unknown_error';
}

export type ProgrammableCard = ProgrammableCardReady | ProgrammableCardNotReady;

export interface VendorLoggedIn {
  readonly status: 'logged_in';
  readonly user: VendorUser;
  readonly sessionExpiresAt: Date;
}

export interface SystemAdministratorLoggedIn {
  readonly status: 'logged_in';
  readonly user: SystemAdministratorUser;
  readonly sessionExpiresAt: Date;
  readonly programmableCard: ProgrammableCard;
}

export interface ElectionManagerLoggedIn {
  readonly status: 'logged_in';
  readonly user: ElectionManagerUser;
  readonly sessionExpiresAt: Date;
}

export type LoggedIn =
  | VendorLoggedIn
  | SystemAdministratorLoggedIn
  | ElectionManagerLoggedIn;

export type AuthStatus = LoggedOut | CheckingPin | RemoveCard | LoggedIn;

export const DEFAULT_AUTH_STATUS: Readonly<AuthStatus> = {
  status: 'logged_out',
  reason: 'machine_locked',
};
