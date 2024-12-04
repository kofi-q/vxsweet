import {
  concurrently,
  ConcurrentlyCommandInput,
  KillOnSignal,
  KillOthers,
  LogError,
  LogExit,
  Logger,
  LogOutput,
} from 'concurrently';
import { ForegroundColor } from 'chalk';
import path from 'node:path';
import { Writable } from 'node:stream';

type CommandInfo = Exclude<ConcurrentlyCommandInput, string> & {
  prefixColor: typeof ForegroundColor;
};

const COLOR_OPTIONS: Array<typeof ForegroundColor> = [
  'yellow',
  'blue',
  'magenta',
];

interface IO {
  readonly stdout: Writable;
  readonly stderr: Writable;
}

main(process.argv, {
  stdout: process.stdout,
  stderr: process.stderr,
})
  .then((exitCode) => {
    process.exitCode = exitCode;
  })
  .catch((error) => {
    console.error(error.stack);
    process.exit(1);
  });

export async function main(
  argv: readonly string[],
  { stdout }: IO
): Promise<number> {
  const [, , ...executables] = argv;
  const logger = new Logger({});

  // Always run the core commands.
  const commands: CommandInfo[] = executables.map((exe, i) => ({
    name: path.basename(exe),
    command: exe,
    prefixColor: COLOR_OPTIONS[i],
  }));

  const running = concurrently(commands, {
    logger,
    cwd: process.env['PWD'],
    outputStream: stdout,
    controllers: [
      new LogOutput({ logger }),
      new LogError({ logger }),
      new LogExit({ logger }),
      new KillOnSignal({ process }),
      new KillOthers({
        logger,
        conditions: ['failure', 'success'],
      }),
    ],
  });

  for (const closeEvent of await running.result) {
    if (typeof closeEvent.exitCode === 'number' && closeEvent.exitCode !== 0) {
      return closeEvent.exitCode;
    }
  }

  return 0;
}
