import { Meta } from '@storybook/react';

import { LanguageCode } from '@vx/libs/types/languages';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { assertDefined } from '@vx/libs/basics/assert';

import {
  UiString as Component,
  type UiStringProps as Props,
} from './ui_string';
import {
  TEST_UI_STRING_TRANSLATIONS,
  testUiStrings,
  NumPlanets,
} from '../../test/test_ui_strings';
import { Caption, H4, P } from '../../primitives/typography';
import { QUERY_CLIENT_DEFAULT_OPTIONS } from '../../src/react_query';
import { SegmentedButton } from '../../buttons/segmented_button';
import { UiStringsContextProvider } from '../context/ui_strings_context';
import {
  type UiStringsReactQueryApi,
  createUiStringsApi,
} from '../api/ui_strings_api';
import { useFrontendLanguageContext } from '../language_context/language_context';

const initialProps: Partial<Props> = {
  children: null,
  pluralCount: 9,
};

const meta: Meta<typeof Component> = {
  title: 'libs-ui/UiString',
  component: Component,
  args: initialProps,
};

export default meta;

const queryClient = new QueryClient({
  defaultOptions: QUERY_CLIENT_DEFAULT_OPTIONS,
});

function LanguagePicker(): React.ReactNode {
  const languageContext = useFrontendLanguageContext();
  if (!languageContext) {
    return null;
  }

  const { availableLanguages, currentLanguageCode, setLanguage } =
    languageContext;

  return (
    <SegmentedButton
      label="Language:"
      hideLabel
      onChange={setLanguage}
      options={availableLanguages.map((code) => ({ id: code, label: code }))}
      selectedOptionId={currentLanguageCode}
    />
  );
}

const uiStringsApi: UiStringsReactQueryApi = createUiStringsApi(() => ({
  getAudioClips: () => Promise.reject(new Error('not yet implemented')),
  getAvailableLanguages: () =>
    Promise.resolve([
      LanguageCode.ENGLISH,
      LanguageCode.CHINESE_TRADITIONAL,
      LanguageCode.SPANISH,
    ]),
  getUiStringAudioIds: () => Promise.reject(new Error('not yet implemented')),
  getUiStrings: ({ languageCode }) =>
    Promise.resolve(TEST_UI_STRING_TRANSLATIONS[languageCode] || null),
}));

export function UiString(props: Props): JSX.Element {
  const { pluralCount } = props;

  return (
    <QueryClientProvider client={queryClient}>
      <UiStringsContextProvider api={uiStringsApi}>
        <H4 as="h1">Pluralized String:</H4>
        <P>
          <code>numPlanets:</code>{' '}
          <NumPlanets pluralCount={assertDefined(pluralCount)} />
        </P>
        <H4 as="h1">ID-Disambiguated String:</H4>
        <P>
          <code>planetName.planet1:</code> {testUiStrings.planetName('planet1')}
        </P>
        <P>
          <code>planetName.planet3:</code> {testUiStrings.planetName('planet3')}
        </P>
        <P>
          <code>planetName.planet9:</code> {testUiStrings.planetName('planet9')}
        </P>
        <H4 as="h1">Config:</H4>
        <P>
          <LanguagePicker />
        </P>
        <Caption>
          <code>
            <pre>
              {JSON.stringify(TEST_UI_STRING_TRANSLATIONS, undefined, 2)}
            </pre>
          </code>
        </Caption>
      </UiStringsContextProvider>
    </QueryClientProvider>
  );
}
