import type { PrecinctScannerStatus } from '@vx/apps/scan/backend/src';

export function scannerStatus(
  props: Partial<PrecinctScannerStatus> = {}
): PrecinctScannerStatus {
  return {
    state: 'no_paper',
    ballotsCounted: 0,
    ...props,
  };
}
