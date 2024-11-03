import 'styled-components';
import { type UiTheme } from '@vx/libs/types/src';

declare module 'styled-components' {
  /**
   * Defines the theme type used by styled-components for all clients of this
   * component.
   *
   * See https://styled-components.com/docs/api#create-a-declarations-file
   */
  export interface DefaultTheme extends UiTheme {}
}
