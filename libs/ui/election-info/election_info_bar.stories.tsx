import { Meta } from '@storybook/react';

import * as electionTwoPartyPrimary from '@vx/libs/fixtures/src/data/electionTwoPartyPrimary/election.json';

import {
  ElectionInfoBar,
  type ElectionInfoBarProps,
} from './election_info_bar';

const initialArgs: ElectionInfoBarProps = {
  codeVersion: '00986543',
  electionDefinition: electionTwoPartyPrimary.toElectionDefinition(),
  electionPackageHash: '11111111111111111111',
  machineId: '00123456',
  mode: 'admin',
  precinctSelection: {
    kind: 'AllPrecincts',
  },
};

const meta: Meta<typeof ElectionInfoBar> = {
  title: 'libs-ui/ElectionInfoBar',
  component: ElectionInfoBar,
  args: initialArgs,
};

export default meta;

export { ElectionInfoBar };
