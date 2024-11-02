import { type PrecinctScannerStatus } from '../../../backend/types/types';

export function scannerStatus(
  props: Partial<PrecinctScannerStatus> = {}
): PrecinctScannerStatus {
  return {
    state: 'no_paper',
    ballotsCounted: 0,
    ...props,
  };
}
