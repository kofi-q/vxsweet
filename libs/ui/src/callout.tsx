import styled from 'styled-components';
import { type IconName, Icons } from '../primitives/icons';
import { Card, type CardProps } from '../primitives/card';

export interface CalloutProps
  extends Pick<CardProps, 'color' | 'className' | 'style' | 'children'> {
  icon?: IconName | JSX.Element;
}

const CalloutCard = styled(Card)`
  > div {
    display: flex;
    gap: 0.5rem;
  }
`;

export function Callout({
  icon,
  children,
  ...cardProps
}: CalloutProps): JSX.Element {
  const iconContent =
    typeof icon === 'string'
      ? (() => {
          const Component = Icons[icon];
          return <Component color={cardProps.color} />;
        })()
      : icon;
  return (
    <CalloutCard {...cardProps}>
      {iconContent}
      {children}
    </CalloutCard>
  );
}
