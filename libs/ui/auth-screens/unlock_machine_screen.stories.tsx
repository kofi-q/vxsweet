import { Meta, StoryObj } from '@storybook/react';
import React from 'react';

import { DateWithoutTime } from '@vx/libs/basics/time';
import { type ElectionId } from '@vx/libs/types/elections';
import {
  UnlockMachineScreen as UnlockMachineScreenComponent,
  type UnlockMachineScreenProps,
} from './unlock_machine_screen';
import { SECURITY_PIN_LENGTH } from '../defs/globals';
import { PinLength } from '../utils/pin_length';

type PropsAndCustomArgs = UnlockMachineScreenProps & {
  minPinLength: number;
  maxPinLength: number;
};

const initialProps: PropsAndCustomArgs = {
  auth: {
    user: {
      role: 'election_manager',
      electionKey: {
        id: 'election-id' as ElectionId,
        date: new DateWithoutTime('2024-07-10'),
      },
      jurisdiction: 'jxn',
    },
    status: 'checking_pin',
  },
  checkPin: async () => {},
  minPinLength: SECURITY_PIN_LENGTH.min,
  maxPinLength: SECURITY_PIN_LENGTH.max,
};

export const UnlockMachineScreen: StoryObj<PropsAndCustomArgs> = {
  render: ({ minPinLength, maxPinLength, ...rest }) => (
    <UnlockMachineScreenComponent
      {...rest}
      pinLength={PinLength.range(minPinLength, maxPinLength)}
    />
  ),
};

const meta: Meta<PropsAndCustomArgs> = {
  title: 'libs-ui/UnlockMachineScreen',
  component:
    UnlockMachineScreen as unknown as React.ComponentType<PropsAndCustomArgs>,
  args: initialProps,
  argTypes: {
    minPinLength: {
      control: {
        type: 'range',
        min: 1,
        max: 10,
        step: 1,
      },
    },
    maxPinLength: {
      control: {
        type: 'range',
        min: 1,
        max: 10,
        step: 1,
      },
    },
    pinLength: {
      if: { global: 'showPinLength', exists: true },
    },
  },
};

export default meta;
