import { GoogleCloudSpeechSynthesizer } from '../language_and_audio/tts/speech_synthesizer';
import { GoogleCloudTranslator } from '../language_and_audio/translation/translator';
import { type Workspace } from '../app/workspace';

export interface WorkerContext {
  speechSynthesizer: GoogleCloudSpeechSynthesizer;
  translator: GoogleCloudTranslator;
  workspace: Workspace;
}
