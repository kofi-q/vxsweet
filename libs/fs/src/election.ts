import { type Result, err } from '@vx/libs/basics/result';
import { type ElectionDefinition } from '@vx/libs/types/elections';
import { safeParseElectionDefinition } from '@vx/libs/types/election-parsing';
import { ZodError } from 'zod';
import { type ReadFileError, readFile } from './read_file';

/**
 * Possible errors that can occur when reading an election.
 */
export type ReadElectionError =
  | { type: 'ReadFileError'; error: ReadFileError }
  | { type: 'ParseError'; error: ZodError | SyntaxError };

/**
 * Maximum size of an election file (30 MB).
 */
const MAX_ELECTION_SIZE = 30 * 1024 * 1024;

/**
 * Reads an election from a file path.
 */
export async function readElection(
  electionPath: string
): Promise<Result<ElectionDefinition, ReadElectionError>> {
  const readFileResult = await readFile(electionPath, {
    maxSize: MAX_ELECTION_SIZE,
    encoding: 'utf-8',
  });

  if (readFileResult.isErr()) {
    return err({ type: 'ReadFileError', error: readFileResult.err() });
  }

  const parseResult = safeParseElectionDefinition(readFileResult.ok());

  if (parseResult.isErr()) {
    return err({ type: 'ParseError', error: parseResult.err() });
  }

  return parseResult;
}
