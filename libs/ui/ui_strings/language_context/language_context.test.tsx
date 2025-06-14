import { LanguageCode } from '@vx/libs/types/languages';
import { act } from 'react';
import {
  screen,
  waitFor,
  render as genericRender,
} from '../../test/react_testing_library';
import { newTestContext } from '../../test/test_context';
import {
  TEST_UI_STRING_TRANSLATIONS,
  testUiStrings,
} from '../../test/test_ui_strings';
import {
  BackendLanguageContextProvider,
  DEFAULT_I18NEXT_NAMESPACE,
  DEFAULT_LANGUAGE_CODE,
} from './language_context';

function setUp() {
  const testContext = newTestContext();
  const { mockApiClient } = testContext;

  jest.resetAllMocks();

  mockApiClient.getAvailableLanguages.mockResolvedValue([
    LanguageCode.ENGLISH,
    LanguageCode.CHINESE_TRADITIONAL,
  ]);

  mockApiClient.getUiStrings.mockImplementation(({ languageCode }) =>
    Promise.resolve(TEST_UI_STRING_TRANSLATIONS[languageCode] || null)
  );

  return testContext;
}

test('availableLanguages', async () => {
  const { getLanguageContext, render } = setUp();

  render(<div>foo</div>);

  await waitFor(() => expect(getLanguageContext()).toBeDefined());
  expect(getLanguageContext()?.availableLanguages).toEqual([
    LanguageCode.ENGLISH,
    LanguageCode.CHINESE_TRADITIONAL,
  ]);
});

test('setLanguage', async () => {
  const { getLanguageContext, render } = setUp();

  render(<div>foo</div>);

  await waitFor(() => expect(getLanguageContext()).toBeDefined());

  expect(getLanguageContext()?.currentLanguageCode).toEqual(
    DEFAULT_LANGUAGE_CODE
  );
  expect(
    getLanguageContext()?.i18next.getResourceBundle(
      DEFAULT_LANGUAGE_CODE,
      DEFAULT_I18NEXT_NAMESPACE
    )
  ).toEqual(TEST_UI_STRING_TRANSLATIONS[DEFAULT_LANGUAGE_CODE]);

  act(
    () => getLanguageContext()?.setLanguage(LanguageCode.CHINESE_TRADITIONAL)
  );

  await waitFor(() =>
    expect(getLanguageContext()?.currentLanguageCode).toEqual(
      LanguageCode.CHINESE_TRADITIONAL
    )
  );
  expect(
    getLanguageContext()?.i18next.getResourceBundle(
      LanguageCode.CHINESE_TRADITIONAL,
      DEFAULT_I18NEXT_NAMESPACE
    )
  ).toEqual(TEST_UI_STRING_TRANSLATIONS[LanguageCode.CHINESE_TRADITIONAL]);
});

test('resets language cache when backend data changes', async () => {
  const {
    getLanguageContext,
    mockApiClient,
    mockReactQueryUiStringsApi,
    queryClient,
    render,
  } = setUp();

  mockApiClient.getUiStrings.mockImplementation(({ languageCode }) =>
    Promise.resolve(TEST_UI_STRING_TRANSLATIONS[languageCode] || null)
  );

  const { rerender } = render(<div>foo</div>);

  await waitFor(() => expect(getLanguageContext()).toBeDefined());
  expect(getLanguageContext()?.currentLanguageCode).toEqual(
    DEFAULT_LANGUAGE_CODE
  );

  // Verify that i18next cache persists after re-render:
  rerender(<div>foo</div>);
  expect(
    getLanguageContext()?.i18next.getResourceBundle(
      DEFAULT_LANGUAGE_CODE,
      DEFAULT_I18NEXT_NAMESPACE
    )
  ).toEqual(TEST_UI_STRING_TRANSLATIONS[DEFAULT_LANGUAGE_CODE]);

  // Simulate machine getting unconfigured/re-configured with no translations:
  mockApiClient.getUiStrings.mockResolvedValue(null);
  await act(() =>
    mockReactQueryUiStringsApi.onMachineConfigurationChange(queryClient)
  );

  // Verify that i18next cache is cleared:
  rerender(<div>foo</div>);
  expect(
    getLanguageContext()?.i18next.getResourceBundle(
      DEFAULT_LANGUAGE_CODE,
      DEFAULT_I18NEXT_NAMESPACE
    )
  ).toBeUndefined();
});

test('BackendLanguageContextProvider', async () => {
  setUp();

  genericRender(
    <BackendLanguageContextProvider
      currentLanguageCode={DEFAULT_LANGUAGE_CODE}
      uiStringsPackage={TEST_UI_STRING_TRANSLATIONS}
    >
      {testUiStrings.planetName('planet3')}
    </BackendLanguageContextProvider>
  );

  await screen.findByText('Earth');

  genericRender(
    <BackendLanguageContextProvider
      currentLanguageCode={LanguageCode.SPANISH}
      uiStringsPackage={TEST_UI_STRING_TRANSLATIONS}
    >
      {testUiStrings.planetName('planet3')}
    </BackendLanguageContextProvider>
  );

  await screen.findByText('Tierra');
});
