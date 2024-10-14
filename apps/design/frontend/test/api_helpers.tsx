import { QueryClientProvider } from '@tanstack/react-query';
import type { Api } from '@vx/apps/design/backend/src';
import { createMockClient, MockClient } from '@vx/libs/grout/test-utils/src';
import { TestErrorBoundary } from '@vx/libs/ui/src';
import { ApiClientContext, createQueryClient } from '../src/api';

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
