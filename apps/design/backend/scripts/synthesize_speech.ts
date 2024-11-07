import { Buffer } from 'node:buffer';
import fs from 'node:fs';
import { extractErrorMessage } from '@vx/libs/basics/errors';
import { LanguageCode } from '@vx/libs/types/src';

import { GoogleCloudSpeechSynthesizer } from '../language_and_audio/tts/speech_synthesizer';
import { Store } from '../store/store';

const languageCodes: string[] = Object.values(LanguageCode);
const usageMessage = `Usage: synthesize-speech 'Text to convert to speech' <language-code> <output-file-path>

Arguments:
  <language-code>\t${[...languageCodes].sort().join(' | ')}
  <output-file-path>\tShould end in .mp3`;

interface SynthesizeSpeechInput {
  languageCode: LanguageCode;
  outputFilePath: string;
  text: string;
}

function parseCommandLineArgs(args: readonly string[]): SynthesizeSpeechInput {
  if (args.length !== 3 || !languageCodes.includes(args[1])) {
    console.error(usageMessage);
    process.exit(1);
  }
  const [text, languageCode, outputFilePath] = args as [
    string,
    LanguageCode,
    string,
  ];
  return { languageCode, outputFilePath, text };
}

async function synthesizeSpeech({
  languageCode,
  outputFilePath,
  text,
}: SynthesizeSpeechInput): Promise<void> {
  const store = Store.memoryStore();
  const speechSynthesizer = new GoogleCloudSpeechSynthesizer({ store });
  const speechBase64 = await speechSynthesizer.synthesizeSpeech(
    text,
    languageCode
  );
  fs.writeFileSync(outputFilePath, Buffer.from(speechBase64, 'base64'));
}

/**
 * A script for synthesizing speech using the Google Cloud Text-to-Speech API
 */
export async function main(args: readonly string[]): Promise<void> {
  try {
    await synthesizeSpeech(parseCommandLineArgs(args));
  } catch (error) {
    console.error(`❌ ${extractErrorMessage(error)}`);
    process.exit(1);
  }
}
