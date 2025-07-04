import { LogEventId, Logger } from '@vx/libs/logging/src';
import { execFile } from '../command_line/exec';
import { intermediateScript } from '../scripts/intermediate_scripts';

/**
 * Powers down the machine.
 */
export async function powerDown(logger: Logger): Promise<void> {
  await logger.logAsCurrentRole(LogEventId.PowerDown, {
    message: 'User powered down the machine.',
  });

  void execFile('sudo', [intermediateScript('power-down')]);
}
