import { createMemoryHistory, MemoryHistory } from 'history';
import React from 'react';
import { Router } from 'react-router-dom';

import * as electionWithEitherNeither from '@vx/libs/fixtures/src/data/electionWithMsEitherNeither/electionWithMsEitherNeither.json';
import {
  type ElectionDefinition,
  constructElectionKey,
  DippedSmartCardAuth,
} from '@vx/libs/types/elections';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  mockElectionManagerUser,
  mockSessionExpiresAt,
} from '@vx/libs/test-utils/src';
import { type MachineConfig } from '../../backend/types/types';
import { mockUsbDriveStatus } from '@vx/libs/ui/test-utils/mock_usb_drive';
import { SystemCallContextProvider } from '@vx/libs/ui/system-calls';
import { TestErrorBoundary } from '@vx/libs/ui/errors';
import { type UsbDriveStatus } from '@vx/libs/usb-drive/src';
import {
  render as testRender,
  type RenderResult,
} from './react_testing_library';
import { AppContext } from '../contexts/app_context';
import { type Iso8601Timestamp } from '../config/types';
import {
  type ApiClient,
  ApiClientContext,
  createQueryClient,
  systemCallApi,
} from '../api/api';
import { type ApiMock } from './helpers/mock_api_client';
export interface RenderInAppContextParams {
  route?: string;
  history?: MemoryHistory;
  electionDefinition?: ElectionDefinition | null;
  configuredAt?: Iso8601Timestamp;
  isOfficialResults?: boolean;
  usbDriveStatus?: UsbDriveStatus;
  auth?: DippedSmartCardAuth.AuthStatus;
  machineConfig?: MachineConfig;
  hasPrinterAttached?: boolean;
  apiMock?: ApiMock;
  queryClient?: QueryClient;
}

export function renderRootElement(
  component: React.ReactNode,
  {
    // If there's no apiClient given, we don't want to create one by default,
    // since the apiClient needs to have assertComplete called by the test. If
    // the test doesn't need to make API calls, then it should not pass in an
    // apiClient here, which will cause an error if the test tries to make an
    // API call.
    apiClient,
    queryClient = createQueryClient(),
  }: {
    apiClient?: ApiClient;
    queryClient?: QueryClient;
  } = {}
): RenderResult {
  return testRender(
    <TestErrorBoundary>
      <ApiClientContext.Provider value={apiClient}>
        <QueryClientProvider client={queryClient}>
          <SystemCallContextProvider api={systemCallApi}>
            {component}
          </SystemCallContextProvider>
        </QueryClientProvider>
      </ApiClientContext.Provider>
    </TestErrorBoundary>
  );
}

export function renderInAppContext(
  component: React.ReactNode,
  {
    route = '/',
    history = createMemoryHistory({ initialEntries: [route] }),
    electionDefinition = electionWithEitherNeither.toElectionDefinition(),
    configuredAt = new Date().toISOString(),
    isOfficialResults = false,
    usbDriveStatus = mockUsbDriveStatus('no_drive'),
    auth = electionDefinition
      ? {
          status: 'logged_in',
          user: mockElectionManagerUser({
            electionKey: constructElectionKey(electionDefinition.election),
          }),
          sessionExpiresAt: mockSessionExpiresAt(),
        }
      : {
          status: 'logged_out',
          reason: 'machine_locked',
        },
    machineConfig = {
      machineId: '0000',
      codeVersion: 'dev',
    },
    apiMock,
    queryClient,
  }: RenderInAppContextParams = {}
): RenderResult {
  return renderRootElement(
    <AppContext.Provider
      value={{
        electionDefinition:
          electionDefinition === null ? undefined : electionDefinition,
        configuredAt,
        isOfficialResults,
        usbDriveStatus,
        auth,
        machineConfig,
        electionPackageHash: 'test-election-package-hash',
      }}
    >
      <Router history={history}>{component}</Router>
    </AppContext.Provider>,
    { apiClient: apiMock?.apiClient, queryClient }
  );
}
