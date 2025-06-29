import { Redirect, Route, Switch } from 'react-router-dom';

import {
  isElectionManagerAuth,
  isSystemAdministratorAuth,
  isVendorAuth,
} from '@vx/libs/utils/src';
import { Main, Screen } from '@vx/libs/ui/screens';
import {
  UnlockMachineScreen,
  InvalidCardScreen,
  RemoveCardScreen,
  SetupCardReaderPage,
} from '@vx/libs/ui/auth-screens';
import { VendorScreen } from '@vx/libs/ui/admin-screens';
import { H1 } from '@vx/libs/ui/primitives';
import { BaseLogger } from '@vx/libs/logging/src';
import { assert } from '@vx/libs/basics/assert';
import { AppContext, type AppContextInterface } from '../contexts/app_context';

import { ScanBallotsScreen } from '../screens/scan/scan_ballots_screen';
import { BallotEjectScreen } from '../screens/eject/ballot_eject_screen';
import { SettingsScreen } from '../screens/settings/settings_screen';

import { MachineLockedScreen } from '../screens/locked/machine_locked_screen';
import {
  checkPin,
  getAuthStatus,
  getElectionRecord,
  getMachineConfig,
  getStatus,
  getTestMode,
  getUsbDriveStatus,
  logOut,
  useApiClient,
} from '../api/api';
import { UnconfiguredElectionScreenWrapper } from '../screens/unconfigured/unconfigured_election_screen_wrapper';
import { SystemAdministratorSettingsScreen } from '../screens/admin/system_administrator_settings_screen';
import { DiagnosticsScreen } from '../screens/diagnostics/diagnostics_screen';

export interface AppRootProps {
  logger: BaseLogger;
}

export function AppRoot({ logger }: AppRootProps): JSX.Element | null {
  const apiClient = useApiClient();
  const machineConfigQuery = getMachineConfig.useQuery();
  const usbDriveStatusQuery = getUsbDriveStatus.useQuery();
  const authStatusQuery = getAuthStatus.useQuery();
  const checkPinMutation = checkPin.useMutation();
  const statusQuery = getStatus.useQuery();
  const logOutMutation = logOut.useMutation();

  const getTestModeQuery = getTestMode.useQuery();
  const isTestMode = getTestModeQuery.data ?? false;

  const electionRecordQuery = getElectionRecord.useQuery();

  if (
    !machineConfigQuery.isSuccess ||
    !authStatusQuery.isSuccess ||
    !usbDriveStatusQuery.isSuccess ||
    !electionRecordQuery.isSuccess ||
    !getTestModeQuery.isSuccess ||
    !statusQuery.isSuccess
  ) {
    return (
      <Screen>
        <Main padded centerChild>
          <H1>Loading Configuration...</H1>
        </Main>
      </Screen>
    );
  }
  const authStatus = authStatusQuery.data;
  const machineConfig = machineConfigQuery.data;
  const usbDriveStatus = usbDriveStatusQuery.data;
  const { electionDefinition, electionPackageHash } =
    electionRecordQuery.data ?? {};
  const status = statusQuery.data;

  const currentContext: AppContextInterface = {
    usbDriveStatus,
    electionDefinition,
    electionPackageHash,
    isTestMode,
    machineConfig,
    logger,
    auth: authStatus,
  };

  if (
    authStatus.status === 'logged_out' &&
    authStatus.reason === 'no_card_reader'
  ) {
    return <SetupCardReaderPage usePollWorkerLanguage={false} />;
  }

  if (authStatus.status === 'logged_out') {
    if (
      authStatus.reason === 'machine_locked' ||
      authStatus.reason === 'machine_locked_by_session_expiry'
    ) {
      return (
        <AppContext.Provider value={currentContext}>
          <MachineLockedScreen />
        </AppContext.Provider>
      );
    }
    return (
      <InvalidCardScreen
        reasonAndContext={authStatus}
        recommendedAction={
          electionDefinition
            ? 'Use a valid election manager or system administrator card.'
            : 'Use an election manager card.'
        }
        cardInsertionDirection="right"
      />
    );
  }

  if (authStatus.status === 'checking_pin') {
    return (
      <UnlockMachineScreen
        auth={authStatus}
        checkPin={async (pin) => {
          try {
            await checkPinMutation.mutateAsync({ pin });
          } catch {
            // Handled by default query client error handling
          }
        }}
      />
    );
  }

  if (authStatus.status === 'remove_card') {
    return (
      <RemoveCardScreen
        productName="VxCentralScan"
        cardInsertionDirection="right"
      />
    );
  }

  if (isVendorAuth(authStatus)) {
    return (
      <VendorScreen
        logOut={() => logOutMutation.mutate()}
        rebootToVendorMenu={() => apiClient.rebootToVendorMenu()}
      />
    );
  }

  if (isSystemAdministratorAuth(authStatus)) {
    return (
      <AppContext.Provider value={currentContext}>
        <Switch>
          <Route path="/system-administrator-settings">
            <SystemAdministratorSettingsScreen />
          </Route>
          <Route path="/hardware-diagnostics">
            <DiagnosticsScreen />
          </Route>
          <Redirect to="/system-administrator-settings" />
        </Switch>
      </AppContext.Provider>
    );
  }

  if (!electionDefinition) {
    return (
      <AppContext.Provider value={currentContext}>
        <UnconfiguredElectionScreenWrapper
          isElectionManagerAuth={isElectionManagerAuth(authStatus)}
        />
      </AppContext.Provider>
    );
  }

  if (status.adjudicationsRemaining > 0) {
    return (
      <AppContext.Provider value={currentContext}>
        <BallotEjectScreen isTestMode={isTestMode} />
      </AppContext.Provider>
    );
  }

  assert(isElectionManagerAuth(authStatus));
  return (
    <AppContext.Provider value={currentContext}>
      <Switch>
        <Route path="/scan">
          <ScanBallotsScreen
            status={status}
            statusIsStale={statusQuery.isStale}
          />
        </Route>
        <Route path="/settings">
          <SettingsScreen
            isTestMode={isTestMode}
            canUnconfigure={status.canUnconfigure}
          />
        </Route>
        <Route path="/hardware-diagnostics">
          <DiagnosticsScreen />
        </Route>
        <Redirect to="/scan" />
      </Switch>
    </AppContext.Provider>
  );
}
