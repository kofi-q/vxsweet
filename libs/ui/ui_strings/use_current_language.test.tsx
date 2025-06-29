import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LanguageCode } from '@vx/libs/types/languages';
import { act } from 'react';
import { createUiStringsApi } from './api/ui_strings_api';
import { UiStringsContextProvider } from './context/ui_strings_context';
import { useCurrentLanguage } from './use_current_language';
import {
  DEFAULT_LANGUAGE_CODE,
  type FrontendLanguageContextInterface,
  useFrontendLanguageContext,
} from './language_context/language_context';

test('returns default language when rendered without context', () => {
  const { result } = renderHook(() => useCurrentLanguage());

  expect(result.current).toEqual(DEFAULT_LANGUAGE_CODE);
});

test('returns current language when rendered within context', async () => {
  const api = createUiStringsApi(() => ({
    getAudioClips: jest.fn(),
    getAvailableLanguages: jest.fn().mockResolvedValue([]),
    getUiStringAudioIds: jest.fn(),
    getUiStrings: jest.fn().mockResolvedValue(null),
  }));

  function TestHookWrapper(props: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={new QueryClient()}>
        <UiStringsContextProvider {...props} api={api} noAudio />
      </QueryClientProvider>
    );
  }

  let setLanguage: FrontendLanguageContextInterface['setLanguage'];
  const { result } = renderHook(
    () => {
      setLanguage = useFrontendLanguageContext()!.setLanguage;
      return useCurrentLanguage();
    },
    { wrapper: TestHookWrapper }
  );

  await waitFor(() => expect(result.current).toEqual(DEFAULT_LANGUAGE_CODE));

  act(() => setLanguage(LanguageCode.SPANISH));
  await waitFor(() => expect(result.current).toEqual(LanguageCode.SPANISH));
});
