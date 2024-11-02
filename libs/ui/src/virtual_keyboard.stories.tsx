import { Meta } from '@storybook/react';

import { VirtualKeyboard, type VirtualKeyboardProps } from './virtual_keyboard';

const initialArgs: Partial<VirtualKeyboardProps> = {
  keyDisabled: () => false,
};

const meta: Meta<typeof VirtualKeyboard> = {
  title: 'libs-ui/VirtualKeyboard',
  component: VirtualKeyboard,
  args: initialArgs,
};

export default meta;

export { VirtualKeyboard };
