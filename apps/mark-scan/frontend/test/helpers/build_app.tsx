import { mockBaseLogger, BaseLogger } from '@vx/libs/logging/src';
import { render, RenderResult } from '../react_testing_library';
import { App } from '../../src/app';
import { createApiMock } from './mock_api_client';

export function buildApp(apiMock: ReturnType<typeof createApiMock>): {
  logger: BaseLogger;
  reload: () => void;
  renderApp: () => RenderResult;
} {
  const logger = mockBaseLogger();
  const reload = jest.fn();
  function renderApp() {
    return render(<App logger={logger} apiClient={apiMock.mockApiClient} />);
  }

  return {
    logger,
    reload,
    renderApp,
  };
}
