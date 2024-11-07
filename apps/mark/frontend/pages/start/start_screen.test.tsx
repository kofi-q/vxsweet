import { Route } from 'react-router-dom';
import {
  electionTwoPartyPrimaryDefinition,
  electionGeneralDefinition,
} from '@vx/libs/fixtures/src';
import { createMemoryHistory } from 'history';
import { hasTextAcrossElements } from '@vx/libs/test-utils/src';
import { MARK_FLOW_UI_VOTER_SCREEN_TEST_ID } from '@vx/libs/mark-flow-ui/src';
import { type BallotStyleId } from '@vx/libs/types/elections';
import { screen } from '../../test/react_testing_library';
import { render } from '../../test/test_utils';
import { StartScreen } from './start_screen';

test('renders StartScreen', () => {
  const electionDefinition = electionTwoPartyPrimaryDefinition;
  render(<Route path="/" component={StartScreen} />, {
    ballotStyleId: '1M' as BallotStyleId,
    electionDefinition,
    precinctId: 'precinct-1',
    route: '/',
  });
  const heading = screen.getByRole('heading', {
    name: 'Mammal Party Example Primary Election',
  });
  screen.getByText('September 8, 2021');
  screen.getByText(
    hasTextAcrossElements('Precinct 1, Sample County, State of Sample')
  );
  screen.getByText(hasTextAcrossElements('Ballot style: 1M'));
  screen.getByText(
    hasTextAcrossElements('Number of contests on your ballot: 7')
  );
  expect(
    heading.parentElement!.parentElement!.getElementsByTagName('img')
  ).toHaveLength(1); // Seal
});

it('renders as voter screen', () => {
  const electionDefinition = electionGeneralDefinition;
  const history = createMemoryHistory({ initialEntries: ['/'] });

  render(<Route path="/" component={StartScreen} />, {
    ballotStyleId: '12' as BallotStyleId,
    electionDefinition,
    history,
    precinctId: '23',
    route: '/',
  });

  screen.getByTestId(MARK_FLOW_UI_VOTER_SCREEN_TEST_ID);
});
