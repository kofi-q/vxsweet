import * as electionGeneralLib from '@vx/libs/fixtures/src/data/electionGeneral/election.json';
import * as electionWithMsEitherNeither from '@vx/libs/fixtures/src/data/electionWithMsEitherNeither/electionWithMsEitherNeither.json';
import userEvent from '@testing-library/user-event';
import { find } from '@vx/libs/basics/collections';
import {
  type CandidateContest,
  type YesNoContest,
} from '@vx/libs/types/elections';
import { hasTextAcrossElements } from '@vx/libs/test-utils/src';
import { render, screen } from '../../test/react_testing_library';
const electionGeneralDefinition = electionGeneralLib.toElectionDefinition();
const electionWithMsEitherNeitherDefinition =
  electionWithMsEitherNeither.toElectionDefinition();

import { Contest } from './contest';
import {
  type MsEitherNeitherContest,
  mergeMsEitherNeitherContests,
} from '../utils/ms_either_neither_contests';

const electionGeneral = electionGeneralDefinition.election;

const candidateContest = find(
  electionGeneral.contests,
  (c): c is CandidateContest => c.type === 'candidate'
);
const yesnoContest = find(
  electionGeneral.contests,
  (c): c is YesNoContest => c.type === 'yesno'
);
const msEitherNeitherContest = find(
  mergeMsEitherNeitherContests(
    electionWithMsEitherNeitherDefinition.election.contests
  ),
  (c): c is MsEitherNeitherContest => c.type === 'ms-either-neither'
);

test.each([
  ['with votes', candidateContest.candidates.slice(0, 1)],
  ['without votes', undefined],
])('candidate contest %s', (_, vote) => {
  render(
    <Contest
      election={electionGeneral}
      contest={candidateContest}
      votes={{
        [candidateContest.id]: vote,
      }}
      updateVote={jest.fn()}
    />
  );
  screen.getByText(candidateContest.title);
  // Tested further in candidate_contest.test.tsx
});

test('yesno contest', () => {
  render(
    <Contest
      election={electionGeneral}
      contest={yesnoContest}
      votes={{
        [yesnoContest.id]: [yesnoContest.yesOption.id],
      }}
      updateVote={jest.fn()}
    />
  );
  screen.getByRole('heading', { name: yesnoContest.title });
  // Tested further in yes_no_contest.test.tsx
});

test('renders ms-either-neither contests', () => {
  const electionDefinition = electionWithMsEitherNeitherDefinition;
  const updateVote = jest.fn();
  render(
    <Contest
      election={electionDefinition.election}
      contest={msEitherNeitherContest}
      votes={{}}
      updateVote={updateVote}
    />
  );

  screen.getByText('Ballot Measure 1');
  userEvent.click(
    screen.getByRole('option', { name: /for approval of either/i })
  );
  expect(updateVote).toHaveBeenCalledWith('750000015', [
    msEitherNeitherContest.eitherOption.id,
  ]);
  userEvent.click(screen.getByRole('option', { name: /for alternative/i }));
  expect(updateVote).toHaveBeenCalledWith('750000016', [
    msEitherNeitherContest.secondOption.id,
  ]);
  // Tested further in ms_either_neither_contest.test.tsx
});

test('renders breadcrumbs', () => {
  render(
    <Contest
      breadcrumbs={{ ballotContestCount: 15, contestNumber: 3 }}
      contest={yesnoContest}
      election={electionGeneral}
      updateVote={jest.fn()}
      votes={{}}
    />
  );

  screen.getByText(hasTextAcrossElements(/contest number: 3/i));
  screen.getByText(hasTextAcrossElements(/total contests: 15/i));
});
