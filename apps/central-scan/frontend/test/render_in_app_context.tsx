import * as testElection from '@vx/libs/fixtures/src/data/electionGeneral/election.json';
import { LogSource } from '@vx/libs/logging/src/base_types';
import { BaseLogger } from '@vx/libs/logging/src';
import {
  DippedSmartCardAuth,
  constructElectionKey,
  type ElectionDefinition,
} from '@vx/libs/types/elections';
import { SystemCallContextProvider } from '@vx/libs/ui/system-calls';
import { TestErrorBoundary } from '@vx/libs/ui/errors';
import { createMemoryHistory, MemoryHistory } from 'history';
import React from 'react';
import { Router } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  mockElectionManagerUser,
  mockSessionExpiresAt,
} from '@vx/libs/test-utils/src';
import { type UsbDriveStatus } from '@vx/libs/usb-drive/src';
import { render, type RenderResult } from './react_testing_library';
import { ApiClientContext, createQueryClient, systemCallApi } from '../api/api';
import { AppContext, type AppContextInterface } from '../contexts/app_context';
import { type ApiMock } from './api';

const testElectionDefinition = testElection.toElectionDefinition();

interface RenderInAppContextParams {
  route?: string;
  history?: MemoryHistory;
  electionDefinition?: ElectionDefinition;
  machineId?: string;
  usbDriveStatus?: UsbDriveStatus;
  usbDriveEject?: () => void;
  auth?: DippedSmartCardAuth.AuthStatus;
  logger?: BaseLogger;
  apiMock?: ApiMock;
  queryClient?: QueryClient;
}

export function makeAppContext({
  electionDefinition = testElectionDefinition,
  electionPackageHash = 'test-election-package-hash',
  isTestMode = false,
  machineConfig = {
    machineId: '0000',
    codeVersion: 'TEST',
  },
  usbDriveStatus = { status: 'no_drive' },
  auth = {
    status: 'logged_in',
    user: mockElectionManagerUser({
      electionKey: constructElectionKey(electionDefinition.election),
    }),
    sessionExpiresAt: mockSessionExpiresAt(),
  },
  logger = new BaseLogger(LogSource.VxCentralScanFrontend),
}: Partial<AppContextInterface> = {}): AppContextInterface {
  return {
    electionDefinition,
    electionPackageHash,
    isTestMode,
    machineConfig,
    usbDriveStatus,
    auth,
    logger,
  };
}

export function wrapInAppContext(
  component: React.ReactNode,
  {
    route = '/',
    history = createMemoryHistory({ initialEntries: [route] }),
    electionDefinition,
    machineId = '0000',
    usbDriveStatus,
    auth,
    logger,
    apiMock,
    queryClient = createQueryClient(),
  }: RenderInAppContextParams = {}
): React.ReactElement {
  return (
    <TestErrorBoundary>
      <ApiClientContext.Provider value={apiMock?.apiClient}>
        <QueryClientProvider client={queryClient}>
          <SystemCallContextProvider api={systemCallApi}>
            <AppContext.Provider
              value={makeAppContext({
                electionDefinition,
                machineConfig: { machineId, codeVersion: 'TEST' },
                usbDriveStatus,
                auth,
                logger,
              })}
            >
              <Router history={history}>{component}</Router>
            </AppContext.Provider>
          </SystemCallContextProvider>
        </QueryClientProvider>
      </ApiClientContext.Provider>
    </TestErrorBoundary>
  );
}

export function renderInAppContext(
  component: React.ReactNode,
  params: RenderInAppContextParams = {}
): RenderResult {
  return render(wrapInAppContext(component, params));
}
