import { BrowserRouter, Route } from 'react-router-dom';

import { BaseLogger } from '@vx/libs/logging/src';
import { LogSource } from '@vx/libs/logging/src/base_types';
import { QueryClient } from '@tanstack/react-query';
import { AppErrorBoundary } from '@vx/libs/ui/errors';
import { AppRoot } from './app_root';
import { type ApiClient, createApiClient, createQueryClient } from '../api/api';
import { ScanAppBase } from '../app-base/scan_app_base';
import { SessionTimeLimitTracker } from '../components/time-limits/tracker';
import { Paths } from '../constants/constants';
import { VoterSettingsScreen } from '../screens/voter/voter_settings_screen';
import { ApiProvider } from '../api/api_provider';

export interface AppProps {
  logger?: BaseLogger;
  apiClient?: ApiClient;
  queryClient?: QueryClient;
  enableStringTranslation?: boolean;
}

const RESTART_MESSAGE = 'Ask a poll worker to restart the scanner.';

export function App({
  logger = new BaseLogger(LogSource.VxScanFrontend, window.kiosk),
  apiClient = createApiClient(),
  queryClient = createQueryClient(),
  enableStringTranslation,
}: AppProps): JSX.Element {
  return (
    <ScanAppBase>
      <BrowserRouter>
        <AppErrorBoundary restartMessage={RESTART_MESSAGE} logger={logger}>
          <ApiProvider
            queryClient={queryClient}
            apiClient={apiClient}
            enableStringTranslation={enableStringTranslation}
          >
            <Route path={Paths.VOTER_SETTINGS} exact>
              <VoterSettingsScreen />
            </Route>
            <Route path={Paths.APP_ROOT} exact>
              <AppRoot />
            </Route>
            <SessionTimeLimitTracker />
          </ApiProvider>
        </AppErrorBoundary>
      </BrowserRouter>
    </ScanAppBase>
  );
}
