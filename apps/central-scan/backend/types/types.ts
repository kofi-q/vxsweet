import { type BatchInfo } from '@vx/libs/types/src';

export interface MachineConfig {
  machineId: string;
  codeVersion: string;
}

export type ScanState = 'idle' | 'scanning' | 'adjudication';

export interface ScanStatus {
  isScannerAttached: boolean;
  ongoingBatchId?: BatchInfo['id'];
  adjudicationsRemaining: number;
  batches: BatchInfo[];
  canUnconfigure: boolean;
}
