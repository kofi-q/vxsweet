import { appStrings } from '@vx/libs/ui/ui_strings/ui_string';

// NOTE: Keep in sync with the value of appStrings.warningBmdInactiveSession:
// VVSG Requirement: 2–5 minutes
export const IDLE_TIMEOUT_SECONDS = 5 * 60;
export const idleTimeoutWarningStringFn = appStrings.warningBmdInactiveSession;

// VVSG Requirement: 20–45 seconds
export const IDLE_RESET_TIMEOUT_SECONDS = 45;
export const WRITE_IN_CANDIDATE_MAX_LENGTH = 40;
