import * as grout from '@vx/libs/grout/src';
import { type Api } from '../../backend/src/dev_dock_api';
import React from 'react';

export type ApiClient = grout.Client<Api>;

export const ApiClientContext = React.createContext<ApiClient | undefined>(
  undefined
);

export function useApiClient(): ApiClient {
  const apiClient = React.useContext(ApiClientContext);
  // istanbul ignore next
  if (!apiClient) {
    throw new Error('ApiClientContext.Provider not found');
  }
  return apiClient;
}
