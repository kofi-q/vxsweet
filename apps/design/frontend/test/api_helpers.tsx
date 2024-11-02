import { QueryClientProvider } from '@tanstack/react-query';
import { type Api } from '../../backend/app/app';
import {
  createMockClient,
  type MockClient,
} from '@vx/libs/grout/test-utils/src';
import { TestErrorBoundary } from '@vx/libs/ui/src';
import { ApiClientContext, createQueryClient } from '../api/api';

export type MockApiClient = MockClient<Api>;

export function createMockApiClient(): MockApiClient {
  return createMockClient<Api>();
}

export function provideApi(
  apiMock: ReturnType<typeof createMockApiClient>,
  children: React.ReactNode
): JSX.Element {
  return (
    <TestErrorBoundary>
      <ApiClientContext.Provider value={apiMock}>
        <QueryClientProvider client={createQueryClient()}>
          {children}
        </QueryClientProvider>
      </ApiClientContext.Provider>
    </TestErrorBoundary>
  );
}
