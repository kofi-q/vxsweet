import { BrowserRouter } from 'react-router-dom';

import { BaseLogger } from '@vx/libs/logging/src';
import { LogSource } from '@vx/libs/logging/src/base_types';
import { QueryClient } from '@tanstack/react-query';
import { AppBase } from '@vx/libs/ui/themes';
import { AppErrorBoundary } from '@vx/libs/ui/errors';
import { VisualModeDisabledOverlay } from '@vx/libs/ui/audio-visual-modes';
import {
  type ColorMode,
  type ScreenType,
  type SizeMode,
} from '@vx/libs/types/ui-theme';

import { AppRoot } from './app_root';
import { type ApiClient, createApiClient, createQueryClient } from '../api/api';
import { SessionTimeLimitTracker } from '../components/session_time_limit_tracker';
import { ApiProvider } from '../api/api_provider';

window.oncontextmenu = (e: MouseEvent): void => {
  e.preventDefault();
};

const DEFAULT_COLOR_MODE: ColorMode = 'contrastMedium';
const DEFAULT_SCREEN_TYPE: ScreenType = 'elo15';
const DEFAULT_SIZE_MODE: SizeMode = 'touchMedium';

export interface Props {
  logger?: BaseLogger;
  apiClient?: ApiClient;
  queryClient?: QueryClient;
  enableStringTranslation?: boolean;
  noAudio?: boolean;
}

const RESTART_MESSAGE =
  'Ask a poll worker to restart the ballot marking device.';

export function App({
  logger = new BaseLogger(LogSource.VxMarkScanFrontend, window.kiosk),
  /* istanbul ignore next */ apiClient = createApiClient(),
  queryClient = createQueryClient(),
  enableStringTranslation,
  noAudio,
}: Props): JSX.Element {
  return (
    <AppBase
      defaultColorMode={DEFAULT_COLOR_MODE}
      defaultSizeMode={DEFAULT_SIZE_MODE}
      screenType={DEFAULT_SCREEN_TYPE}
    >
      <BrowserRouter>
        <AppErrorBoundary restartMessage={RESTART_MESSAGE} logger={logger}>
          <ApiProvider
            queryClient={queryClient}
            apiClient={apiClient}
            enableStringTranslation={enableStringTranslation}
            noAudio={noAudio}
          >
            <VisualModeDisabledOverlay />
            <AppRoot />
            <SessionTimeLimitTracker />
          </ApiProvider>
        </AppErrorBoundary>
      </BrowserRouter>
    </AppBase>
  );
}
