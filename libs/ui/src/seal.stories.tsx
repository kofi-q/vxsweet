import { Meta } from '@storybook/react';
import { electionGeneral } from '@vx/libs/fixtures/src';

import { Seal, SealProps } from './seal';

const meta: Meta<typeof Seal> = {
  title: 'libs-ui/Seal',
  component: Seal,
};

export default meta;

export function seal(props: SealProps): JSX.Element {
  return <Seal {...props} seal={electionGeneral.seal} maxWidth="7rem" />;
}
