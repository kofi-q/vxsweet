import { throwIllegalValue } from '@vx/libs/basics/src';
import {
  type PollsTransition,
  type PrecinctScannerPollsInfo,
} from '../../../backend/types/types';
import { type PollsState, type PollsTransitionType } from '@vx/libs/types/src';

/**
 * Because you can get to the opened state by either opening polls or resuming
 * voting, we don't know exactly what the last transition was. But we want to
 * interpolate our best guess for testing ease.
 */
function getLikelyLastPollsTransitionType(
  pollsState: Exclude<PollsState, 'polls_closed_initial'>
): PollsTransitionType {
  switch (pollsState) {
    case 'polls_closed_final':
      return 'close_polls';
    case 'polls_open':
      return 'open_polls';
    case 'polls_paused':
      return 'pause_voting';
    // istanbul ignore next
    default:
      throwIllegalValue(pollsState);
  }
}

export function mockPollsInfo(
  pollsState: PollsState,
  lastPollsTransition?: Partial<PollsTransition>
): PrecinctScannerPollsInfo {
  if (pollsState === 'polls_closed_initial') {
    return {
      pollsState,
    };
  }
  return {
    pollsState,
    lastPollsTransition: {
      type: getLikelyLastPollsTransitionType(pollsState),
      time: Date.now(),
      ballotCount: 0,
      ...(lastPollsTransition ?? {}),
    },
  };
}
