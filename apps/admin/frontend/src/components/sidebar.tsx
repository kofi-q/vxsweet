import React from 'react';
import { Link, useRouteMatch } from 'react-router-dom';
import {
  AppLogo,
  LeftNav,
  NavLink,
  NavList,
  NavListItem,
  VerticalElectionInfoBar,
} from '@vx/libs/ui/src';

import { assertDefined } from '@vx/libs/basics/src';
import { AppContext } from '../contexts/app_context';

export interface SidebarProps {
  navItems: readonly NavItem[];
}

export interface NavItem {
  label: React.ReactNode;
  routerPath: string;
}

export function Sidebar(props: SidebarProps): JSX.Element {
  const { navItems } = props;
  const currentRoute = useRouteMatch();

  const { electionDefinition, electionPackageHash, machineConfig } =
    React.useContext(AppContext);

  function isActivePath(path: string): boolean {
    return currentRoute.path.startsWith(path);
  }

  return (
    <LeftNav>
      <Link to="/">
        <AppLogo appName="VxAdmin" />
      </Link>
      <NavList>
        {navItems.map(({ label, routerPath }) => (
          <NavListItem key={routerPath}>
            <NavLink to={routerPath} isActive={isActivePath(routerPath)}>
              {label}
            </NavLink>
          </NavListItem>
        ))}
      </NavList>
      {electionDefinition && (
        <div style={{ marginTop: 'auto' }}>
          <VerticalElectionInfoBar
            mode="admin"
            electionDefinition={electionDefinition}
            electionPackageHash={assertDefined(electionPackageHash)}
            codeVersion={machineConfig.codeVersion}
            machineId={machineConfig.machineId}
            inverse
          />
        </div>
      )}
    </LeftNav>
  );
}
