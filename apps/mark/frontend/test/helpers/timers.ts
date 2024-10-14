import { advanceTimers as advanceTimersBase } from '@vx/libs/test-utils/src';
import { AUTH_STATUS_POLLING_INTERVAL_MS } from '@vx/libs/ui/src';
import { waitFor } from '../react_testing_library';

export function advanceTimers(seconds = 0): void {
  advanceTimersBase(seconds || AUTH_STATUS_POLLING_INTERVAL_MS / 1000);
}

export async function advanceTimersAndPromises(seconds = 0): Promise<void> {
  advanceTimers(seconds);
  await waitFor(() => {
    // Wait for promises
  });
}
