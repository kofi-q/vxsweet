import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import {
  SystemCallContextProvider,
  UiStringsContextProvider,
} from '@vx/libs/ui/src';
import {
  ApiClient,
  ApiClientContext,
  createQueryClient,
  systemCallApi,
  uiStringsApi,
} from './api';

export function ApiProvider({
  queryClient = createQueryClient(),
  apiClient,
  enableStringTranslation,
  noAudio,
  children,
}: {
  queryClient?: QueryClient;
  apiClient: ApiClient;
  enableStringTranslation?: boolean;
  noAudio?: boolean;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <ApiClientContext.Provider value={apiClient}>
      <QueryClientProvider client={queryClient}>
        <SystemCallContextProvider api={systemCallApi}>
          <UiStringsContextProvider
            api={uiStringsApi}
            disabled={!enableStringTranslation}
            noAudio={noAudio}
          >
            {children}
          </UiStringsContextProvider>
        </SystemCallContextProvider>
      </QueryClientProvider>
    </ApiClientContext.Provider>
  );
}
