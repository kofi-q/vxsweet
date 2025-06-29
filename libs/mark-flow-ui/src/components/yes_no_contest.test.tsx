jest.mock(
  '@vx/libs/ui/accessible_controllers',
  (): typeof import('@vx/libs/ui/accessible_controllers') => ({
    ...jest.requireActual('@vx/libs/ui/accessible_controllers'),
    useIsPatDeviceConnected: jest.fn(),
  })
);
jest.mock(
  '@vx/libs/ui/touch-controls',
  (): typeof import('@vx/libs/ui/touch-controls') => ({
    ...jest.requireActual('@vx/libs/ui/touch-controls'),
    WithScrollButtons: jest.fn(({ children }) => (
      <div data-testid={MOCK_WITH_SCROLL_BUTTONS_TEST_ID}>{children}</div>
    )),
  })
);

import { election as electionGeneral } from '@vx/libs/fixtures/src/data/electionGeneral/election.json';
import { election as electionTwoPartyPrimary } from '@vx/libs/fixtures/src/data/electionTwoPartyPrimary/election.json';
import { type YesNoContest as YesNoContestInterface } from '@vx/libs/types/elections';
import userEvent from '@testing-library/user-event';
import { advanceTimers } from '@vx/libs/test-utils/src';
import { useIsPatDeviceConnected } from '@vx/libs/ui/accessible_controllers';
import {
  WithScrollButtons,
  type WithScrollButtonsProps,
} from '@vx/libs/ui/touch-controls';
import { screen, within, render } from '../../test/react_testing_library';
import { YesNoContest } from './yes_no_contest';

const MOCK_WITH_SCROLL_BUTTONS_TEST_ID = 'MockWithScrollButtons';

const mockUseIsPatDeviceConnected = jest.mocked(useIsPatDeviceConnected);
const MockWithScrollButtons = jest.mocked(WithScrollButtons);

const contest = electionTwoPartyPrimary.contests.find(
  (c) => c.id === 'fishing' && c.type === 'yesno'
) as YesNoContestInterface;

function getOption(accessibleName: string | RegExp) {
  return screen.getByRole('option', { name: accessibleName });
}

beforeEach(() => {
  mockUseIsPatDeviceConnected.mockReturnValue(false);
});

test('voting for both yes and no', () => {
  const updateVote = jest.fn();
  render(
    <YesNoContest
      election={electionTwoPartyPrimary}
      contest={contest}
      updateVote={updateVote}
    />
  );

  screen.getByRole('heading', { name: contest.title });

  within(screen.getByTestId(MOCK_WITH_SCROLL_BUTTONS_TEST_ID)).getByText(
    contest.description
  );

  const contestChoices = screen.getByTestId('contest-choices');
  userEvent.click(within(contestChoices).getByText('YES').closest('button')!);
  expect(updateVote).toHaveBeenCalledTimes(1);

  userEvent.click(within(contestChoices).getByText('NO').closest('button')!);
  expect(updateVote).toHaveBeenCalledTimes(2);
});

test('changing votes', () => {
  const updateVote = jest.fn();
  render(
    <YesNoContest
      election={electionTwoPartyPrimary}
      contest={contest}
      vote={[contest.yesOption.id]}
      updateVote={updateVote}
    />
  );
  const contestChoices = screen.getByTestId('contest-choices');
  userEvent.click(within(contestChoices).getByText('NO').closest('button')!);
  within(screen.getByRole('alertdialog')).getByText(/first deselect/i);
  userEvent.click(screen.getByText('Okay'));
});

test('audio cue for vote', () => {
  jest.useFakeTimers();

  const updateVote = jest.fn();
  const { rerender } = render(
    <YesNoContest
      election={electionTwoPartyPrimary}
      contest={contest}
      updateVote={updateVote}
    />
  );

  const yesButton = getOption(/YES/i);

  // initial state just has a description of the choice
  getOption(/Ballot Measure 3.+yes/i);
  userEvent.click(yesButton);

  // manually handle updating the vote
  rerender(
    <YesNoContest
      election={electionTwoPartyPrimary}
      contest={contest}
      vote={[contest.yesOption.id]}
      updateVote={updateVote}
    />
  );

  // now the choice is selected
  getOption(/Selected.+Ballot Measure 3.+yes/i);

  // unselect the choice
  userEvent.click(yesButton);

  // manually handle updating the vote
  rerender(
    <YesNoContest
      election={electionTwoPartyPrimary}
      contest={contest}
      vote={[]}
      updateVote={updateVote}
    />
  );

  // now the choice is deselected
  getOption(/Deselected.+Ballot Measure 3.+yes/i);

  // after a second, the choice is no longer selected or deselected
  advanceTimers(1);
  getOption(/Ballot Measure 3.+yes/i);
});

test('can focus and click scroll buttons with PAT device', () => {
  mockUseIsPatDeviceConnected.mockReturnValue(true);

  render(
    <YesNoContest
      election={electionTwoPartyPrimary}
      contest={contest}
      vote={[contest.yesOption.id]}
      updateVote={jest.fn()}
    />
  );

  expect(MockWithScrollButtons).toHaveBeenCalledWith(
    expect.objectContaining<Partial<WithScrollButtonsProps>>({
      focusable: true,
    }),
    expect.anything()
  );
});

test('scroll button focus is disabled when no PAT device is connected', () => {
  mockUseIsPatDeviceConnected.mockReturnValue(false);

  render(
    <YesNoContest
      election={electionTwoPartyPrimary}
      contest={contest}
      vote={[contest.yesOption.id]}
      updateVote={jest.fn()}
    />
  );

  expect(MockWithScrollButtons).toHaveBeenCalledWith(
    expect.objectContaining<Partial<WithScrollButtonsProps>>({
      focusable: false,
    }),
    expect.anything()
  );
});

test('renders rich text', () => {
  const richTextContest = electionGeneral.contests.find(
    (c): c is YesNoContestInterface =>
      c.type === 'yesno' && Boolean(c.description.match(/<p>/))
  )!;
  render(
    <YesNoContest
      election={electionGeneral}
      contest={richTextContest}
      updateVote={jest.fn()}
    />
  );

  const title = screen.getByRole('heading', { name: richTextContest.title });
  const contestHeader = title.parentElement!.parentElement!;
  expect(contestHeader.innerHTML).toContain(richTextContest.description);
});
