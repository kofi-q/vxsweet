import { LogEventId, Logger } from '@vx/libs/logging/src';
import { execFile } from '../command_line/exec';
import { intermediateScript } from '../scripts/intermediate_scripts';

/**
 * Reboots the machine into the BIOS.
 */
export async function rebootToBios(logger: Logger): Promise<void> {
  await logger.logAsCurrentRole(LogEventId.RebootMachine, {
    message: 'User rebooted the machine into the BIOS.',
  });

  void execFile('sudo', [intermediateScript('reboot-to-bios')]);
}
