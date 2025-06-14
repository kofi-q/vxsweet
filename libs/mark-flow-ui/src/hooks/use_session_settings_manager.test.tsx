jest.mock(
  '@vx/libs/ui/ui_strings/screen-reader',
  (): typeof import('@vx/libs/ui/ui_strings/screen-reader') => ({
    ...jest.requireActual('@vx/libs/ui/ui_strings/screen-reader'),
    useAudioControls: () => mockAudioControls,
  })
);
jest.mock(
  '@vx/libs/ui/ui_strings/audio-controls',
  (): typeof import('@vx/libs/ui/ui_strings/audio-controls') => ({
    ...jest.requireActual('@vx/libs/ui/ui_strings/audio-controls'),
    useAudioEnabled: jest.fn(),
  })
);
jest.mock(
  '@vx/libs/ui/ui_strings',
  (): typeof import('@vx/libs/ui/ui_strings') => ({
    ...jest.requireActual('@vx/libs/ui/ui_strings'),
    useCurrentLanguage: jest.fn(),
    useLanguageControls: () => mockLanguageControls,
  })
);

import { DefaultTheme, ThemeContext } from 'styled-components';
import React from 'react';
import { VoterSettingsManagerContext, AppBase } from '@vx/libs/ui/themes';
import {
  type LanguageControls,
  useCurrentLanguage,
} from '@vx/libs/ui/ui_strings';
import { useAudioEnabled } from '@vx/libs/ui/ui_strings/audio-controls';
import {
  mockCardlessVoterUser,
  mockElectionManagerUser,
  mockSessionExpiresAt,
  mockUseAudioControls,
  mockOf,
} from '@vx/libs/test-utils/src';
import { type AudioControls } from '@vx/libs/types/ui_strings';
import { LanguageCode } from '@vx/libs/types/languages';
import { InsertedSmartCardAuth } from '@vx/libs/types/elections';
import { act, renderHook } from '../../test/react_testing_library';
import { useSessionSettingsManager } from './use_session_settings_manager';

const mockAudioControls = mockUseAudioControls();
const mockLanguageControls: jest.Mocked<LanguageControls> = {
  reset: jest.fn(),
  setLanguage: jest.fn(),
};

const mockUseAudioEnabled = mockOf(useAudioEnabled);
const mockUseCurrentLanguage = mockOf(useCurrentLanguage);

const DEFAULT_THEME = {
  colorMode: 'contrastMedium',
  sizeMode: 'touchMedium',
  isVisualModeDisabled: false,
} as const satisfies Partial<DefaultTheme>;
const { CHINESE_SIMPLIFIED, ENGLISH, SPANISH } = LanguageCode;

const VOTER_AUTH: InsertedSmartCardAuth.AuthStatus = {
  status: 'logged_in',
  user: mockCardlessVoterUser(),
  sessionExpiresAt: mockSessionExpiresAt(),
};

const ELECTION_MANAGER_AUTH: InsertedSmartCardAuth.AuthStatus = {
  status: 'logged_in',
  user: mockElectionManagerUser(),
  cardlessVoterUser: mockCardlessVoterUser(),
  sessionExpiresAt: mockSessionExpiresAt(),
};

function TestHookWrapper(props: { children: React.ReactNode }) {
  return (
    <AppBase
      {...props}
      defaultColorMode={DEFAULT_THEME.colorMode}
      defaultSizeMode={DEFAULT_THEME.sizeMode}
      defaultIsVisualModeDisabled={DEFAULT_THEME.isVisualModeDisabled ?? false}
      disableFontsForTests
    />
  );
}

function useTestHook() {
  const [authStatus, setMockAuth] = React.useState(VOTER_AUTH);
  const [mockLanguage, setMockLanguage] = React.useState(ENGLISH);
  const [mockAudioEnabled, setMockAudioEnabled] = React.useState(true);

  mockUseCurrentLanguage.mockReturnValue(mockLanguage);
  mockUseAudioEnabled.mockReturnValue(mockAudioEnabled);

  const theme = React.useContext(ThemeContext);
  const voterSettingsManager = React.useContext(VoterSettingsManagerContext);

  const { onSessionEnd } = useSessionSettingsManager({ authStatus });

  return {
    theme,
    onSessionEnd,
    setMockAudioEnabled,
    setMockAuth,
    setMockLanguage,
    voterSettingsManager,
  };
}

const ALLOWED_AUDIO_CONTROLS: ReadonlySet<keyof AudioControls> = new Set<
  keyof AudioControls
>(['setIsEnabled']);

afterEach(() => {
  // Catch any unexpected audio control usage:
  for (const method of Object.keys(mockAudioControls) as Array<
    keyof AudioControls
  >) {
    if (ALLOWED_AUDIO_CONTROLS.has(method)) {
      continue;
    }

    expect(mockAudioControls[method]).not.toHaveBeenCalled();
  }
});

test('Resets settings when election official logs in', () => {
  const { result } = renderHook(useTestHook, { wrapper: TestHookWrapper });

  expect(result.current.theme).toEqual(
    expect.objectContaining<Partial<DefaultTheme>>(DEFAULT_THEME)
  );
  expect(mockLanguageControls.reset).not.toHaveBeenCalled();
  expect(mockLanguageControls.setLanguage).not.toHaveBeenCalled();
  expect(mockAudioControls.reset).not.toHaveBeenCalled();
  expect(mockAudioControls.setIsEnabled).not.toHaveBeenCalled();

  // Simulate changing session settings as voter:
  act(() => {
    result.current.voterSettingsManager.setColorMode('contrastLow');
    result.current.voterSettingsManager.setSizeMode('touchExtraLarge');
    result.current.voterSettingsManager.setIsVisualModeDisabled(true);
  });
  expect(result.current.theme).toEqual(
    expect.objectContaining<Partial<DefaultTheme>>({
      colorMode: 'contrastLow',
      sizeMode: 'touchExtraLarge',
      isVisualModeDisabled: true,
    })
  );

  act(() => {
    result.current.setMockLanguage(SPANISH);
    result.current.setMockAudioEnabled(true);
  });

  // Should reset session settings on Election Manager login:
  act(() => result.current.setMockAuth(ELECTION_MANAGER_AUTH));

  expect(result.current.theme).toEqual(
    expect.objectContaining<Partial<DefaultTheme>>(DEFAULT_THEME)
  );
  expect(mockLanguageControls.reset).toHaveBeenCalled();
  expect(mockLanguageControls.setLanguage).not.toHaveBeenCalled();
  expect(mockAudioControls.setIsEnabled).toHaveBeenLastCalledWith(false);

  // Simulate changing session settings as Election Manager:
  act(() => {
    result.current.voterSettingsManager.setColorMode('contrastHighDark');
    result.current.voterSettingsManager.setSizeMode('touchSmall');
  });
  expect(result.current.theme).toEqual(
    expect.objectContaining<Partial<DefaultTheme>>({
      colorMode: 'contrastHighDark',
      sizeMode: 'touchSmall',
    })
  );
  act(() => result.current.setMockLanguage(CHINESE_SIMPLIFIED));

  // Should return to voter settings on return to voter session:
  act(() => result.current.setMockAuth(VOTER_AUTH));

  expect(result.current.theme).toEqual(
    expect.objectContaining<Partial<DefaultTheme>>({
      colorMode: 'contrastLow',
      sizeMode: 'touchExtraLarge',
      isVisualModeDisabled: true,
    })
  );
  expect(mockLanguageControls.setLanguage).toHaveBeenCalledWith(SPANISH);
  expect(mockAudioControls.setIsEnabled).toHaveBeenLastCalledWith(true);
  expect(mockAudioControls.reset).not.toHaveBeenCalled();
});

test('Clears stored voter settings when session is ended', () => {
  const { result } = renderHook(useTestHook, { wrapper: TestHookWrapper });

  // Simulate changing session settings as voter:
  act(() => {
    result.current.voterSettingsManager.setColorMode('contrastLow');
    result.current.voterSettingsManager.setSizeMode('touchExtraLarge');
    result.current.voterSettingsManager.setIsVisualModeDisabled(true);
    result.current.setMockLanguage(SPANISH);
    result.current.setMockAudioEnabled(false);
  });

  expect(result.current.theme).toEqual(
    expect.objectContaining<Partial<DefaultTheme>>({
      colorMode: 'contrastLow',
      sizeMode: 'touchExtraLarge',
      isVisualModeDisabled: true,
    })
  );

  // Simulate logging in as Election Manager and ending the voter session:
  act(() => {
    result.current.setMockAuth(ELECTION_MANAGER_AUTH);
    result.current.onSessionEnd();
  });

  mockLanguageControls.reset.mockReset();
  mockLanguageControls.setLanguage.mockReset();
  mockAudioControls.reset.mockReset();
  mockAudioControls.setIsEnabled.mockReset();

  // Logging back in as a voter after session end should be a no-op:
  act(() => result.current.setMockAuth(VOTER_AUTH));

  expect(result.current.theme).toEqual(
    expect.objectContaining<Partial<DefaultTheme>>(DEFAULT_THEME)
  );
  expect(mockLanguageControls.reset).not.toHaveBeenCalled();
  expect(mockLanguageControls.setLanguage).not.toHaveBeenCalled();
  expect(mockAudioControls.reset).not.toHaveBeenCalled();
  expect(mockAudioControls.setIsEnabled).not.toHaveBeenCalled();
});
