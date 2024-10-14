import type { MachineConfig } from '@vx/apps/mark-scan/backend/src';

export function mockMachineConfig({
  machineId = '000',
  codeVersion = 'test',
  screenOrientation = 'portrait',
}: Partial<MachineConfig> = {}): MachineConfig {
  return { machineId, codeVersion, screenOrientation };
}
