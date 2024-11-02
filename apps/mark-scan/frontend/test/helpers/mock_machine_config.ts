import { type MachineConfig } from '../../../backend/types/types';

export function mockMachineConfig({
  machineId = '000',
  codeVersion = 'test',
  screenOrientation = 'portrait',
}: Partial<MachineConfig> = {}): MachineConfig {
  return { machineId, codeVersion, screenOrientation };
}
