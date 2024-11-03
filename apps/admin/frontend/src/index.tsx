import './polyfills';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { DevDock } from '@vx/libs/dev-dock/frontend/src';
import {
  BooleanEnvironmentVariableName,
  isFeatureFlagEnabled,
} from '@vx/libs/utils/src';
import { AppBase } from '@vx/libs/ui/themes';
import { AppErrorBoundary } from '@vx/libs/ui/errors';
import { SystemCallContextProvider } from '@vx/libs/ui/system-calls';
import { assert } from '@vx/libs/basics/src';
import { LogSource } from '@vx/libs/logging/src/base_types';
import { BaseLogger } from '@vx/libs/logging/src';
import { App } from './app';
import {
  ApiClientContext,
  createApiClient,
  createQueryClient,
  systemCallApi,
} from '../api/api';

const apiClient = createApiClient();
const queryClient = createQueryClient();

const rootElement = document.getElementById('root');
assert(rootElement);
const root = createRoot(rootElement);
const logger = new BaseLogger(LogSource.VxAdminFrontend, window.kiosk);

root.render(
  <React.StrictMode>
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
              <App />
              {isFeatureFlagEnabled(
                BooleanEnvironmentVariableName.ENABLE_REACT_QUERY_DEVTOOLS
              ) && (
                <div>
                  <ReactQueryDevtools
                    initialIsOpen={false}
                    position="top-left"
                  />
                </div>
              )}
            </SystemCallContextProvider>
          </QueryClientProvider>
        </ApiClientContext.Provider>
      </AppErrorBoundary>
      <DevDock />
    </AppBase>
  </React.StrictMode>
);
