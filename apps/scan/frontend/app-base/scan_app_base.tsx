import React from 'react';

import { AppBase } from '@vx/libs/ui/themes';
import {
  type ColorMode,
  type ScreenType,
  type SizeMode,
} from '@vx/libs/types/ui-theme';

export interface AppBaseProps {
  children: React.ReactNode;
}

const DEFAULT_COLOR_MODE: ColorMode = 'contrastMedium';
const DEFAULT_SCREEN_TYPE: ScreenType = 'elo13';
const DEFAULT_SIZE_MODE: SizeMode = 'touchMedium';

/**
 * Installs global styles and UI themes - should be rendered at the root of the
 * app before anything else.
 */
export function ScanAppBase({ children }: AppBaseProps): JSX.Element {
  return (
    <AppBase
      defaultColorMode={DEFAULT_COLOR_MODE}
      defaultSizeMode={DEFAULT_SIZE_MODE}
      screenType={DEFAULT_SCREEN_TYPE}
    >
      {children}
    </AppBase>
  );
}
