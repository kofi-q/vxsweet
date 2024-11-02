import { type UiTheme } from '@vx/libs/types/src';
import React from 'react';
import { ThemeContext } from 'styled-components';

export function useCurrentTheme(): UiTheme {
  return React.useContext(ThemeContext);
}
