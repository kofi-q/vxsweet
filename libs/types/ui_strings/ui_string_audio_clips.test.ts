import { safeParseJson } from '../basic/generic';
import { LanguageCode } from '../languages/language_code';
import { UiStringAudioClipSchema } from './ui_string_audio_clips';

test('valid structure', () => {
  const result = safeParseJson(
    JSON.stringify({
      dataBase64: 'test data',
      id: 'testKey',
      languageCode: LanguageCode.CHINESE_TRADITIONAL,
    }),
    UiStringAudioClipSchema
  );

  expect(result.isOk()).toEqual(true);
  expect(result.ok()).toEqual({
    dataBase64: 'test data',
    id: 'testKey',
    languageCode: LanguageCode.CHINESE_TRADITIONAL,
  });
});

test('missing field', () => {
  const result = safeParseJson(
    JSON.stringify({
      dataBase64: 'test data',
      languageCode: LanguageCode.SPANISH,
    }),
    UiStringAudioClipSchema
  );

  expect(result.isOk()).toEqual(false);
});
