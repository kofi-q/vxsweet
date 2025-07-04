import styled from 'styled-components';
import { LinkButton, type LinkButtonProps } from '../buttons/link_button';
import { Icons } from '../primitives/icons';

/**
 * A left navigation sidebar container.
 */
export const LeftNav = styled.nav`
  background: ${(p) => p.theme.colors.inverseBackground};
  padding: 1rem 0.5rem 0.5rem;
  width: 12rem;
  display: flex;
  flex-direction: column;

  a {
    text-decoration: none;

    &:hover {
      filter: none;
    }
  }
`;

/**
 * A list container for nav items.
 */
export const NavList = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`;

/**
 * A nav item in a NavList.
 */
export const NavListItem = styled.li`
  /* For now, we don't need any specific styles here. */
`;

const NavLinkButton = styled(LinkButton)`
  width: 100%;
  justify-content: start;
`;

/**
 * A nav link in a NavList. Should go inside a NavListItem.
 */
export function NavLink({
  isActive,
  ...linkButtonProps
}: {
  isActive: boolean;
} & LinkButtonProps): JSX.Element {
  return (
    <NavLinkButton
      fill={isActive ? 'tinted' : 'transparent'}
      color="inverseNeutral"
      rightIcon={
        isActive ? (
          <Icons.ChevronRight style={{ marginLeft: 'auto' }} />
        ) : undefined
      }
      {...linkButtonProps}
    />
  );
}

/**
 * A divider line between NavListItems in a NavList.
 */
export const NavDivider = styled.div`
  border-top: ${({ theme }) => theme.sizes.bordersRem.hairline}rem solid
    ${({ theme }) => theme.colors.outline};
  margin: 0.5rem 0;
`;

const LogoContainer = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: -0.125rem;
  margin-bottom: 1rem;

  svg {
    height: 2.5rem;
    width: 2.5rem;
  }

  span {
    font-size: ${(p) => p.theme.sizes.headingsRem.h2}rem;
    font-weight: ${(p) => p.theme.sizes.fontWeight.bold};
    color: ${(p) => p.theme.colors.onInverse};
  }
`;

// From logo-circle-white-on-purple.svg
function LogoCircleWhiteOnPurple() {
  return (
    <svg
      width="100"
      height="100"
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <g clipPath="url(#clip0_16_239)">
        <circle cx="50" cy="50" r="50" fill="#6638B6" />
        <path
          d="M51.9217 85.0882C51.4956 85.0882 51.0629 85.0036 50.6433 84.8278C48.9585 84.1249 48.1718 82.1983 48.8798 80.5255L71.72 26.5934H64.784L40.8622 83.077C40.3443 84.2941 39.1446 85.0882 37.8138 85.0882C36.483 85.0882 35.2833 84.2941 34.7654 83.077L21.2606 51.1707C20.8279 50.1554 20.9393 48.9968 21.5556 48.079C22.1653 47.1613 23.2011 46.6146 24.309 46.6146H37.5188C39.3413 46.6146 40.8228 48.0856 40.8228 49.9015C40.8228 51.7175 39.3413 53.1885 37.5188 53.1885H29.2848L37.8203 73.3398L59.5394 22.0373C60.0573 20.8201 61.257 20.026 62.5878 20.026H76.6958C77.8037 20.026 78.8395 20.5793 79.4492 21.4905C80.0588 22.4083 80.1703 23.5668 79.7442 24.5822L54.9701 83.077C54.4391 84.3332 53.2132 85.0882 51.9217 85.0882ZM49.9877 31.8265C49.9877 25.3047 45.3266 20 39.6035 20C33.8803 20 29.2127 25.3047 29.2127 31.8265C29.2127 38.3484 33.8738 43.653 39.5969 43.653C45.3201 43.653 49.9877 38.3484 49.9877 31.8265ZM43.3796 31.8265C43.3796 34.6774 41.6489 37.0856 39.6035 37.0856C37.5581 37.0856 35.8274 34.6774 35.8274 31.8265C35.8274 28.9757 37.5581 26.5674 39.6035 26.5674C41.6489 26.5674 43.3796 28.9757 43.3796 31.8265Z"
          fill="white"
        />
      </g>
      <defs>
        <clipPath id="clip0_16_239">
          <rect width="100" height="100" fill="white" />
        </clipPath>
      </defs>
    </svg>
  );
}

/**
 * An app name and logo for the top of a LeftNav. Wrap in a Link to make it a
 * link to the home page.
 */
export function AppLogo({
  appName,
  className,
}: {
  appName: string;
  className?: string;
}): JSX.Element {
  return (
    <LogoContainer className={className}>
      <LogoCircleWhiteOnPurple />
      <span>{appName}</span>
    </LogoContainer>
  );
}
