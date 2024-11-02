import { safeParseJson } from '@vx/libs/types/src';
import { readFileSync } from 'node:fs';
import { assertDefined } from '@vx/libs/basics/src';
import { generateElection } from '../../generate-election/generate_election';
import { GenerateElectionConfigSchema } from '../../generate-election/config';

interface IO {
  stdin: NodeJS.ReadableStream;
  stdout: NodeJS.WritableStream;
  stderr: NodeJS.WritableStream;
}

export function main(argv: readonly string[], { stdout, stderr }: IO): number {
  if (argv.length !== 3) {
    stderr.write('Usage: generate-election <config.json>\n');
    return 1;
  }

  const configPath = assertDefined(argv[2]);
  const configContents = readFileSync(configPath, 'utf8');
  const config = safeParseJson(
    configContents,
    GenerateElectionConfigSchema.deepPartial()
  ).unsafeUnwrap();

  const election = generateElection(config);
  stdout.write(JSON.stringify(election));
  return 0;
}
