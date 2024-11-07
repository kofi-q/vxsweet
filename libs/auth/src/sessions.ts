import { DateTime } from 'luxon';
import { type OverallSessionTimeLimitHours } from '@vx/libs/types/elections';

/**
 * Config params for sessions
 */
export interface SessionConfig {
  overallSessionTimeLimitHours: OverallSessionTimeLimitHours;
}

/**
 * Computes a session end time
 */
export function computeSessionEndTime(
  sessionConfig: SessionConfig,
  sessionStartTime = new Date()
): Date {
  const { overallSessionTimeLimitHours } = sessionConfig;

  return DateTime.fromJSDate(sessionStartTime)
    .plus({ hours: overallSessionTimeLimitHours })
    .toJSDate();
}
