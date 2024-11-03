import { BrowserRouter } from 'react-router-dom';
import { BaseLogger } from '@vx/libs/logging/src';
import { LogSource } from '@vx/libs/logging/src/base_types';
import { AppBase } from '@vx/libs/ui/themes';
import { AppErrorBoundary } from '@vx/libs/ui/errors';
import { BatteryLowAlert } from '@vx/libs/ui/src';
import { SystemCallContextProvider } from '@vx/libs/ui/system-calls';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppRoot, type AppRootProps } from './app_root';
import {
  type ApiClient,
  ApiClientContext,
  createApiClient,
  createQueryClient,
  systemCallApi,
} from '../api/api';
import { SessionTimeLimitTracker } from '../components/session_time_limit_tracker';

export interface Props {
  logger?: AppRootProps['logger'];
  apiClient?: ApiClient;
  queryClient?: QueryClient;
}

export function App({
  logger = new BaseLogger(LogSource.VxCentralScanFrontend, window.kiosk),
  apiClient = createApiClient(),
  queryClient = createQueryClient(),
}: Props): JSX.Element {
  return (
    <BrowserRouter>
      <AppBase
        defaultColorMode="desktop"
        defaultSizeMode="desktop"
        screenType="lenovoThinkpad15"
        showScrollBars
      >
        <AppErrorBoundary
          restartMessage="Please restart the machine."
          logger={logger}
        >
          <ApiClientContext.Provider value={apiClient}>
            <QueryClientProvider client={queryClient}>
              <SystemCallContextProvider api={systemCallApi}>
                <AppRoot logger={logger} />
                <SessionTimeLimitTracker />
                <BatteryLowAlert />
              </SystemCallContextProvider>
            </QueryClientProvider>
          </ApiClientContext.Provider>
        </AppErrorBoundary>
      </AppBase>
    </BrowserRouter>
  );
}
