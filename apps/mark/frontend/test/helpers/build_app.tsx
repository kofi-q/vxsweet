import { mockBaseLogger, BaseLogger } from '@vx/libs/logging/src';
import { render, type RenderResult } from '../react_testing_library';
import { App } from '../../app/app';
import { createApiMock } from './mock_api_client';

export function buildApp(apiMock: ReturnType<typeof createApiMock>): {
  logger: BaseLogger;
  reload: () => void;
  renderApp: () => RenderResult;
} {
  const logger = mockBaseLogger();
  const reload = jest.fn();
  function renderApp() {
    return render(
      <App reload={reload} logger={logger} apiClient={apiMock.mockApiClient} />
    );
  }

  return {
    logger,
    reload,
    renderApp,
  };
}
