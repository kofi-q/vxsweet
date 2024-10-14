import { suppressingConsoleOutput } from '@vx/libs/test-utils/src';
import { renderHook } from '../test/react_testing_library';
import { useApiClient } from './api';

test('useApiClient', () => {
  suppressingConsoleOutput(() => {
    expect(() => {
      renderHook(() => useApiClient());
    }).toThrowError('ApiClientContext.Provider not found');
  });
});
