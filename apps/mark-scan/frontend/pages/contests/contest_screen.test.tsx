import { Route } from 'react-router-dom';
import * as electionGeneralLib from '@vx/libs/fixtures/src/data/electionGeneral/election.json';
import { createMemoryHistory } from 'history';
import { MARK_FLOW_UI_VOTER_SCREEN_TEST_ID } from '@vx/libs/mark-flow-ui/src';
import { screen } from '../../test/react_testing_library';
import { mockMachineConfig } from '../../test/helpers/mock_machine_config';
const electionGeneralDefinition = electionGeneralLib.toElectionDefinition();

import { render as renderWithBallotContext } from '../../test/test_utils';

import { ContestScreen } from './contest_screen';

const electionGeneral = electionGeneralDefinition.election;
const firstContestTitle = electionGeneral.contests[0].title;

it('Renders ContestScreen', async () => {
  renderWithBallotContext(
    <Route path="/contests/:contestNumber" component={ContestScreen} />,
    {
      route: '/contests/0',
      precinctId: electionGeneral.precincts[0].id,
      ballotStyleId: electionGeneral.ballotStyles[0].id,
    }
  );
  await screen.findByRole('heading', { name: firstContestTitle });
  screen.getButton(/next/i);
  screen.getButton(/back/i);
  screen.getByRole('button', { name: 'Settings' });
});

it('Renders ContestScreen in Landscape orientation', async () => {
  renderWithBallotContext(
    <Route path="/contests/:contestNumber" component={ContestScreen} />,
    {
      route: '/contests/0',
      precinctId: electionGeneral.precincts[0].id,
      ballotStyleId: electionGeneral.ballotStyles[0].id,
      machineConfig: mockMachineConfig({ screenOrientation: 'landscape' }),
    }
  );
  await screen.findByRole('heading', { name: firstContestTitle });
});

it('Renders ContestScreen in Landscape orientation in Review Mode', async () => {
  renderWithBallotContext(
    <Route path="/contests/:contestNumber" component={ContestScreen} />,
    {
      route: '/contests/0#review',
      precinctId: electionGeneral.precincts[0].id,
      ballotStyleId: electionGeneral.ballotStyles[0].id,
      machineConfig: mockMachineConfig({ screenOrientation: 'landscape' }),
    }
  );
  await screen.findByRole('heading', { name: firstContestTitle });
  screen.getByText('Review');
});

it('renders as voter screen', () => {
  const history = createMemoryHistory({ initialEntries: ['/contests/0'] });

  renderWithBallotContext(
    <Route path="/contests/:contestNumber" component={ContestScreen} />,
    {
      history,
      route: '/contests/0',
      precinctId: electionGeneral.precincts[0].id,
      ballotStyleId: electionGeneral.ballotStyles[0].id,
    }
  );

  screen.getByTestId(MARK_FLOW_UI_VOTER_SCREEN_TEST_ID);
});
