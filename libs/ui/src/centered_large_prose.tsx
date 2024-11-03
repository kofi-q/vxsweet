import React from 'react';
import { Prose } from '../primitives/prose';
import { fontSizeTheme } from '../themes/themes';

interface CenteredLargeProseProps {
  children: React.ReactNode;
}

/**
 * @deprecated
 */
/* istanbul ignore next */
export function CenteredLargeProse({
  children,
}: CenteredLargeProseProps): JSX.Element {
  return (
    <Prose textCenter maxWidth={false} themeDeprecated={fontSizeTheme.large}>
      {children}
    </Prose>
  );
}
