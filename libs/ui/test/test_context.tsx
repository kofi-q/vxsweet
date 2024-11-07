import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type Optional } from '@vx/libs/basics/types';
import { type AudioControls } from '@vx/libs/types/ui_strings';
import { LanguageCode } from '@vx/libs/types/languages';
import { type SystemCallApi as SystemCallApiClient } from '@vx/libs/backend/src/system_call';
import {
  type UiStringsApiClient,
  type UiStringsReactQueryApi,
  createUiStringsApi,
} from '../ui_strings/api/ui_strings_api';
import {
  type FrontendLanguageContextInterface,
  useFrontendLanguageContext,
} from '../ui_strings/language_context/language_context';
import {
  type UiStringsAudioContextInterface,
  useAudioContext,
} from '../ui_strings/audio-context/audio_context';
import { UiStringsContextProvider } from '../ui_strings/context/ui_strings_context';
import { type RenderResult, render, renderHook } from './react_testing_library';
import { QUERY_CLIENT_DEFAULT_OPTIONS } from '../src/react_query';
import { type VxRenderOptions } from '../themes/render_with_themes';
import { useAudioControls } from '../ui_strings/screen-reader/use_audio_controls';
import {
  type SystemCallReactQueryApi,
  createSystemCallApi,
  SystemCallContextProvider,
} from '../system-calls/system_call_api';
import { type SignedHashValidationApiClient } from '../ballots/signed_hash_validation_button';

type ApiClient = UiStringsApiClient &
  SystemCallApiClient &
  SignedHashValidationApiClient;

export interface TestContext {
  getAudioContext: () => Optional<UiStringsAudioContextInterface>;
  getAudioControls: () => Optional<AudioControls>;
  getLanguageContext: () => Optional<FrontendLanguageContextInterface>;
  mockApiClient: jest.Mocked<ApiClient>;
  mockReactQueryUiStringsApi: UiStringsReactQueryApi;
  queryClient: QueryClient;
  render: (
    ui: React.ReactElement,
    renderOptions?: VxRenderOptions
  ) => RenderResult;
  renderHook: typeof renderHook;
}

export function newTestContext(
  options: {
    skipUiStringsApi?: boolean;
    uiStringsApiOptions?: {
      disabled?: boolean;
      noAudio?: boolean;
    };
  } = {}
): TestContext {
  let currentLanguageContext: Optional<FrontendLanguageContextInterface>;
  let currentAudioContext: Optional<UiStringsAudioContextInterface>;
  let currentAudioControls: Optional<AudioControls>;

  function ContextConsumer() {
    currentAudioContext = useAudioContext();
    currentAudioControls = useAudioControls();
    currentLanguageContext = useFrontendLanguageContext();
    return null;
  }

  const mockUiStringsApiClient: jest.Mocked<UiStringsApiClient> = {
    getAudioClips: jest.fn(),
    getAvailableLanguages: jest.fn(),
    getUiStringAudioIds: jest.fn(),
    getUiStrings: jest.fn(),
  };

  // Set up default mock for `getAvailableLanguages` to unblock initial render.
  mockUiStringsApiClient.getAvailableLanguages.mockResolvedValue([
    LanguageCode.ENGLISH,
  ]);

  // Set up remaining initial mocks for convenience:
  mockUiStringsApiClient.getUiStrings.mockResolvedValue(null);
  mockUiStringsApiClient.getUiStringAudioIds.mockResolvedValue(null);
  mockUiStringsApiClient.getAudioClips.mockResolvedValue([]);

  const mockSystemCallApiClient: jest.Mocked<SystemCallApiClient> = {
    rebootToBios: jest.fn(),
    rebootToVendorMenu: jest.fn(),
    powerDown: jest.fn(),
    setClock: jest.fn(),
    exportLogsToUsb: jest.fn(),
    getBatteryInfo: jest.fn(),
    getAudioInfo: jest.fn(),
  };

  const mockSignedHashValidationApiClient: jest.Mocked<SignedHashValidationApiClient> =
    {
      generateSignedHashValidationQrCodeValue: jest.fn(),
    };

  const mockApiClient = {
    ...mockUiStringsApiClient,
    ...mockSystemCallApiClient,
    ...mockSignedHashValidationApiClient,
  } as const;

  const mockReactQueryUiStringsApi: UiStringsReactQueryApi = createUiStringsApi(
    () => mockApiClient
  );

  const mockReactQuerySystemCallApi: SystemCallReactQueryApi =
    createSystemCallApi(() => mockApiClient);

  const queryClient = new QueryClient({
    defaultOptions: QUERY_CLIENT_DEFAULT_OPTIONS,
  });

  function Wrapper(props: { children?: React.ReactNode }) {
    const { children } = props;

    if (options.skipUiStringsApi) {
      return (
        <QueryClientProvider client={queryClient}>
          <SystemCallContextProvider api={mockReactQuerySystemCallApi}>
            {children}
          </SystemCallContextProvider>
        </QueryClientProvider>
      );
    }

    return (
      <QueryClientProvider client={queryClient}>
        <SystemCallContextProvider api={mockReactQuerySystemCallApi}>
          <UiStringsContextProvider
            api={mockReactQueryUiStringsApi}
            disabled={options.uiStringsApiOptions?.disabled}
            noAudio={options.uiStringsApiOptions?.noAudio}
          >
            <ContextConsumer />
            {children}
          </UiStringsContextProvider>
        </SystemCallContextProvider>
      </QueryClientProvider>
    );
  }

  return {
    mockApiClient,
    mockReactQueryUiStringsApi,
    queryClient,
    render: (ui, renderOptions) => {
      const result = render(<Wrapper>{ui}</Wrapper>, renderOptions);
      return {
        ...result,
        rerender: (newUi) => result.rerender(<Wrapper>{newUi}</Wrapper>),
      };
    },
    renderHook: (renderer) => renderHook(renderer, { wrapper: Wrapper }),
    getAudioContext: () => currentAudioContext,
    getAudioControls: () => currentAudioControls,
    getLanguageContext: () => currentLanguageContext,
  };
}
