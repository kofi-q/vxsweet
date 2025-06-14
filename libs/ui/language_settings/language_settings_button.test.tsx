jest.mock(
  '../ui_strings/with_alt_audio',
  (): typeof import('../ui_strings/with_alt_audio') => ({
    ...jest.requireActual('../ui_strings/with_alt_audio'),
    WithAltAudio: ({ audioText, children }) => (
      <React.Fragment>
        <span data-testid={MOCK_ALT_AUDIO_PRIMARY_TEXT_TEST_ID}>
          {children}
        </span>
        <span data-testid={MOCK_ALT_AUDIO_ALT_TEXT_TEST_ID}>{audioText}</span>
      </React.Fragment>
    ),
  })
);

import {
  ElectionStringKey,
  type UiStringsPackage,
} from '@vx/libs/types/ui_strings';
import { LanguageCode } from '@vx/libs/types/languages';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { advancePromises } from '@vx/libs/test-utils/src';
import { newTestContext } from '../test/test_context';
import { LanguageSettingsButton } from './language_settings_button';
import { act, screen } from '../test/react_testing_library';

const MOCK_ALT_AUDIO_PRIMARY_TEXT_TEST_ID = 'MockAltAudioPrimaryText';
const MOCK_ALT_AUDIO_ALT_TEXT_TEST_ID = 'MockAltAudioAltText';

const { CHINESE_SIMPLIFIED, ENGLISH, SPANISH } = LanguageCode;

test('displays current language', async () => {
  const { getLanguageContext, mockApiClient, render } = newTestContext();

  mockApiClient.getAvailableLanguages.mockResolvedValue([ENGLISH, SPANISH]);

  const testTranslations: UiStringsPackage = {
    [ENGLISH]: { [ElectionStringKey.BALLOT_LANGUAGE]: 'English' },
    [SPANISH]: { [ElectionStringKey.BALLOT_LANGUAGE]: 'Español' },
  };
  mockApiClient.getUiStrings.mockImplementation((input) =>
    Promise.resolve(testTranslations[input.languageCode] || null)
  );

  render(<LanguageSettingsButton onPress={jest.fn()} />);
  await screen.findButton(/English/);

  act(() => getLanguageContext()?.setLanguage(SPANISH));
  await screen.findButton(/Español/);
});

test('fires onPress event', async () => {
  const { mockApiClient, render } = newTestContext();

  mockApiClient.getAvailableLanguages.mockResolvedValue([ENGLISH, SPANISH]);

  const onPress = jest.fn();

  render(<LanguageSettingsButton onPress={onPress} />);
  expect(onPress).not.toHaveBeenCalled();

  userEvent.click(await screen.findButton(/English/));
  expect(onPress).toHaveBeenCalledTimes(1);
});

test('not rendered in single-language contexts', async () => {
  const { mockApiClient, render } = newTestContext();

  mockApiClient.getAvailableLanguages.mockResolvedValue([ENGLISH]);

  render(
    <div>
      <h1>Welcome</h1>
      <LanguageSettingsButton onPress={jest.fn()} />
    </div>
  );
  await screen.findByText('Welcome');

  expect(screen.queryByRole('button')).not.toBeInTheDocument();
});

test('plays audio instructions in all languages', async () => {
  const { getLanguageContext, mockApiClient, render } = newTestContext();

  mockApiClient.getAvailableLanguages.mockResolvedValue([
    ENGLISH,
    SPANISH,
    CHINESE_SIMPLIFIED,
  ]);

  const testTranslations: UiStringsPackage = {
    [ENGLISH]: {
      [ElectionStringKey.BALLOT_LANGUAGE]: 'English',
      labelCurrentLanguage: '(English Label)',
      instructionsLanguageSettingsButton: '(English Instructions)',
    },
    [SPANISH]: {
      [ElectionStringKey.BALLOT_LANGUAGE]: 'Español',
      labelCurrentLanguage: '(Spanish Label)',
      instructionsLanguageSettingsButton: '(Spanish Instructions)',
    },
    [CHINESE_SIMPLIFIED]: {
      [ElectionStringKey.BALLOT_LANGUAGE]: '简体中文',
      labelCurrentLanguage: '(Chinese Label)',
      instructionsLanguageSettingsButton: '(Chinese Instructions)',
    },
  };
  mockApiClient.getUiStrings.mockImplementation((input) =>
    Promise.resolve(testTranslations[input.languageCode] || null)
  );

  render(<LanguageSettingsButton onPress={jest.fn()} />);
  await advancePromises();
  act(() => getLanguageContext()?.setLanguage(SPANISH));
  await advancePromises();

  expect(
    screen.getByTestId(MOCK_ALT_AUDIO_PRIMARY_TEXT_TEST_ID)
  ).toHaveTextContent('Español');

  await advancePromises();
  expect(screen.getByTestId(MOCK_ALT_AUDIO_ALT_TEXT_TEST_ID)).toHaveTextContent(
    [
      '(Spanish Label) Español',
      '(Spanish Instructions)',
      '(English Instructions)',
      '(Chinese Instructions)',
    ].join('')
  );
});
