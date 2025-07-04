import yargs from 'yargs/yargs';
import { promisify } from 'node:util';
import { exec as callbackExec } from 'node:child_process';
import toml from '@iarna/toml';
import fs from 'node:fs/promises';
import { createReadStream, createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import {
  configFilepath,
  logEventIdsOutputFilepath,
  logEventIdsTemplateFilepath,
  checkTypescriptOutputTempFilepath,
} from './filepaths';
import {
  type GenerateTypesArgs,
  type ParsedConfig,
  diffAndCleanUp,
  getTypedConfig,
} from './types';

const exec = promisify(callbackExec);

async function prepareOutputFile(filepath: string): Promise<void> {
  await fs.copyFile(logEventIdsTemplateFilepath, filepath);
  await fs.appendFile(filepath, '\n');
}

// formatLogEventIdEnum generates an enum where by convention the member name
// is a title-case event ID and the value is a kebab-case event ID
// eg.
// export enum LogEventId {
//   MyEventId = 'my-event-id',
// }
function* formatLogEventIdEnum(config: ParsedConfig): Generator<string> {
  const entries = Object.entries(config);
  yield 'export enum LogEventId {\n';
  for (const [enumMember, logDetails] of entries) {
    yield `${enumMember} = '${logDetails.eventId}',\n`;
  }
  yield '}\n';
}

// capitalize capitalizes the first character of a string and lower cases the remainder
function capitalize(input: string): string {
  return input.charAt(0).toUpperCase() + input.slice(1).toLowerCase();
}

// kebabCaseToTitleCase expects an input in kebab-case and returns it in TitleCase
function kebabCaseToTitleCase(input: string): string {
  return input.split('-').map(capitalize).join('');
}

function* formatLogDetails(config: ParsedConfig): Generator<string> {
  const entries = Object.entries(config);
  for (const [titleCaseEventId, details] of entries) {
    yield `
    const ${titleCaseEventId}: LogDetails = {
      eventId: LogEventId.${titleCaseEventId},
      eventType: LogEventType.${kebabCaseToTitleCase(details.eventType)},
      documentationMessage: '${details.documentationMessage}',
  `;
    if (details.defaultMessage) {
      yield `defaultMessage: '${details.defaultMessage}',`;
    }
    if (details.restrictInDocumentationToApps) {
      yield `restrictInDocumentationToApps: [${details.restrictInDocumentationToApps.map(
        (appName: string) => `AppName.${kebabCaseToTitleCase(appName)}`
      )}],
    `;
    }
    yield '};\n\n';
  }
}

// formatGetDetailsForEventId generates a function that returns a log's
// `LogDetails` object (ie. the object generated by `formatLogDetails`)
function formatGetDetailsForEventId(config: ParsedConfig): string {
  const keys = Object.keys(config);
  let output = `
    export function getDetailsForEventId(eventId: LogEventId): LogDetails {
      switch (eventId) {
  `;
  for (const key of keys) {
    output += `
      case LogEventId.${key}:
        return ${key};`;
  }

  output += `
      /* istanbul ignore next - compile time check for completeness */
      default:
        throwIllegalValue(eventId);
    }
  }`;

  return output;
}

const argv: GenerateTypesArgs = yargs(process.argv.slice(2)).options({
  check: {
    type: 'boolean',
    description:
      'Check that generated output equals the existing file on disk. Does not overwrite existing file.',
  },
}).argv as GenerateTypesArgs;

async function main(): Promise<void> {
  const { check } = argv;
  const filepath = check
    ? checkTypescriptOutputTempFilepath
    : logEventIdsOutputFilepath;
  await prepareOutputFile(filepath);

  const untypedConfig = await toml.parse.stream(
    createReadStream(configFilepath)
  );
  const typedConfig = getTypedConfig(untypedConfig);

  const out = createWriteStream(filepath);

  // eslint-disable-next-line @typescript-eslint/require-await
  await pipeline(async function* makeRustFile() {
    yield* createReadStream(logEventIdsTemplateFilepath);
    yield* '\n';
    yield* formatLogEventIdEnum(typedConfig);
    yield* formatLogDetails(typedConfig);
    yield* formatGetDetailsForEventId(typedConfig);
  }, out);

  const { stderr } = await exec(`eslint ${filepath} --fix`);
  if (stderr) {
    throw new Error(`Error running eslint: ${stderr}`);
  }

  if (check) {
    await diffAndCleanUp(
      checkTypescriptOutputTempFilepath,
      logEventIdsOutputFilepath
    );
  }
}

void main();
