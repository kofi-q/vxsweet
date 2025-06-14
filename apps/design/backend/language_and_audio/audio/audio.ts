import { Readable } from 'node:stream';
import {
  type UiStringAudioClip,
  type UiStringAudioIdsPackage,
  type UiStringsPackage,
} from '@vx/libs/types/ui_strings';

import {
  BooleanEnvironmentVariableName,
  isFeatureFlagEnabled,
} from '@vx/libs/utils/src';
import { GoogleCloudSpeechSynthesizer } from '../tts/speech_synthesizer';
import {
  forEachUiString,
  prepareTextForSpeechSynthesis,
  setUiStringAudioIds,
} from '../utils/utils';

interface TextToSynthesizeSpeechFor {
  audioId: string;
  languageCode: string;
  text: string;
}

export function generateAudioIdsAndClips({
  appStrings,
  electionStrings,
  speechSynthesizer,
}: {
  appStrings: UiStringsPackage;
  electionStrings: UiStringsPackage;
  speechSynthesizer: GoogleCloudSpeechSynthesizer;
}): {
  uiStringAudioIds: UiStringAudioIdsPackage;
  uiStringAudioClips: NodeJS.ReadableStream;
} {
  /* istanbul ignore next */
  if (
    !isFeatureFlagEnabled(
      BooleanEnvironmentVariableName.ENABLE_CLOUD_TRANSLATION_AND_SPEECH_SYNTHESIS
    )
  ) {
    return { uiStringAudioClips: Readable.from([]), uiStringAudioIds: {} };
  }

  const uiStringAudioIds: UiStringAudioIdsPackage = {};
  const textToSynthesizeSpeechFor: TextToSynthesizeSpeechFor[] = [];

  function populateUiStringAudioIds({
    languageCode,
    stringKey,
    stringInLanguage,
  }: {
    languageCode: string;
    stringKey: string | [string, string];
    stringInLanguage: string;
  }): void {
    const segmentsWithAudioIds = prepareTextForSpeechSynthesis(
      languageCode,
      stringInLanguage
    );
    setUiStringAudioIds(
      uiStringAudioIds,
      languageCode,
      stringKey,
      segmentsWithAudioIds.map(({ audioId }) => audioId)
    );

    textToSynthesizeSpeechFor.push(
      ...segmentsWithAudioIds
        .filter(({ segment }) => !segment.isInterpolated)
        .map(({ audioId, segment }) => ({
          audioId,
          languageCode,
          text: segment.content,
        }))
    );
  }

  // Prepare UI string audio IDs
  forEachUiString(appStrings, populateUiStringAudioIds);
  forEachUiString(electionStrings, populateUiStringAudioIds);

  // Prepare UI string audio clips
  async function* uiStringAudioClipGenerator() {
    for (const { audioId, languageCode, text } of textToSynthesizeSpeechFor) {
      const uiStringAudioClip: UiStringAudioClip = {
        dataBase64: await speechSynthesizer.synthesizeSpeech(
          text,
          languageCode
        ),
        id: audioId,
        languageCode,
      };
      yield `${JSON.stringify(uiStringAudioClip)}\n`;
    }
  }
  const uiStringAudioClips = Readable.from(uiStringAudioClipGenerator());

  return { uiStringAudioIds, uiStringAudioClips };
}
