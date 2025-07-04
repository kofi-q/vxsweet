import React, { useContext } from 'react';

import { Button } from '@vx/libs/ui/buttons';
import { MainHeader, MainContent, Screen, Main } from '@vx/libs/ui/screens';
import { SessionTimeLimitTimer, BatteryDisplay } from '@vx/libs/ui/src';
import { type Route, Breadcrumbs } from '@vx/libs/ui/breadcrumbs';
import { UsbControllerButton } from '@vx/libs/ui/system-controls';
import { H1 } from '@vx/libs/ui/primitives';
import {
  BooleanEnvironmentVariableName,
  isFeatureFlagEnabled,
  isElectionManagerAuth,
  isSystemAdministratorAuth,
} from '@vx/libs/utils/src';

import { DippedSmartCardAuth } from '@vx/libs/types/elections';
import styled from 'styled-components';
import { AppContext } from '../contexts/app_context';
import { routerPaths } from '../paths/router_paths';
import { ejectUsbDrive, logOut } from '../api/api';
import { type NavItem, Sidebar } from './sidebar';

interface Props {
  children: React.ReactNode;
  title?: string;
  parentRoutes?: Route[];
  noPadding?: boolean;
}

const SYSTEM_ADMIN_NAV_ITEMS: readonly NavItem[] = [
  { label: 'Election', routerPath: routerPaths.election },
  { label: 'Smart Cards', routerPath: routerPaths.smartcards },
  { label: 'Settings', routerPath: routerPaths.settings },
  { label: 'Diagnostics', routerPath: routerPaths.hardwareDiagnostics },
];

const ELECTION_MANAGER_NAV_ITEMS: readonly NavItem[] = [
  { label: 'Election', routerPath: routerPaths.election },
  { label: 'Tally', routerPath: routerPaths.tally },
  ...(isFeatureFlagEnabled(BooleanEnvironmentVariableName.WRITE_IN_ADJUDICATION)
    ? [{ label: 'Write-Ins', routerPath: routerPaths.writeIns }]
    : []),
  { label: 'Reports', routerPath: routerPaths.reports },
  { label: 'Settings', routerPath: routerPaths.settings },
  { label: 'Diagnostics', routerPath: routerPaths.hardwareDiagnostics },
];

function getNavItems(auth: DippedSmartCardAuth.AuthStatus) {
  if (isSystemAdministratorAuth(auth)) {
    return SYSTEM_ADMIN_NAV_ITEMS;
  }

  if (isElectionManagerAuth(auth)) {
    return ELECTION_MANAGER_NAV_ITEMS;
  }

  return [];
}

export const Header = styled(MainHeader)`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-left: 0.75rem;
  gap: 0.5rem;
`;

export const HeaderActions = styled.div`
  display: flex;
  gap: 0.5rem;
  align-items: center;
  flex-shrink: 0;
`;

export function NavigationScreen({
  children,
  title,
  parentRoutes,
  noPadding,
}: Props): JSX.Element {
  const { usbDriveStatus, auth } = useContext(AppContext);
  const logOutMutation = logOut.useMutation();
  const ejectUsbDriveMutation = ejectUsbDrive.useMutation();

  return (
    <Screen flexDirection="row">
      <Sidebar navItems={getNavItems(auth)} />
      <Main flexColumn>
        <SessionTimeLimitTimer authStatus={auth} />
        <Header>
          <div>
            {title && (
              <React.Fragment>
                {parentRoutes && (
                  <Breadcrumbs
                    currentTitle={title}
                    parentRoutes={parentRoutes}
                  />
                )}
                <H1>{title}</H1>
              </React.Fragment>
            )}
          </div>
          <HeaderActions>
            {(isSystemAdministratorAuth(auth) ||
              isElectionManagerAuth(auth)) && (
              <React.Fragment>
                <UsbControllerButton
                  usbDriveEject={() => ejectUsbDriveMutation.mutate()}
                  usbDriveStatus={usbDriveStatus}
                  usbDriveIsEjecting={ejectUsbDriveMutation.isLoading}
                />
                <Button onPress={() => logOutMutation.mutate()} icon="Lock">
                  Lock Machine
                </Button>
                <BatteryDisplay />
              </React.Fragment>
            )}
          </HeaderActions>
        </Header>
        <MainContent style={{ padding: noPadding ? 0 : undefined }}>
          {children}
        </MainContent>
      </Main>
    </Screen>
  );
}
