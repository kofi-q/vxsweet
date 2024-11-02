import React from 'react';
import {
  AppLogo,
  LeftNav,
  NavDivider,
  NavListItem,
  NavLink,
  NavList,
} from '@vx/libs/ui/left-nav';
import { Main, Screen } from '@vx/libs/ui/screens';
import { LinkButton } from '@vx/libs/ui/buttons';
import { Link, useRouteMatch } from 'react-router-dom';
import { electionNavRoutes } from '../routes/routes';

export function NavScreen({
  navContent,
  children,
}: {
  navContent?: React.ReactNode;
  children?: React.ReactNode;
}): JSX.Element {
  return (
    <Screen flexDirection="row">
      <LeftNav style={{ width: '14rem' }}>
        <Link to="/">
          <AppLogo appName="VxDesign" />
        </Link>
        {navContent}
      </LeftNav>
      <Main flexColumn>{children}</Main>
    </Screen>
  );
}

export function ElectionNavScreen({
  electionId,
  children,
}: {
  electionId: string;
  children: React.ReactNode;
}): JSX.Element {
  const currentRoute = useRouteMatch();
  return (
    <NavScreen
      navContent={
        <NavList>
          {electionNavRoutes(electionId).map(({ title, path }) => {
            return (
              <NavListItem key={path}>
                <NavLink to={path} isActive={path === currentRoute.url}>
                  {title}
                </NavLink>
              </NavListItem>
            );
          })}
          <NavDivider />
          <NavListItem>
            <LinkButton
              to="/"
              fill="transparent"
              color="inverseNeutral"
              icon="ChevronLeft"
            >
              All Elections
            </LinkButton>
          </NavListItem>
        </NavList>
      }
    >
      {children}
    </NavScreen>
  );
}
