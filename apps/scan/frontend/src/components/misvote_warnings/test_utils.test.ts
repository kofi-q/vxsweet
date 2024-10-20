import { electionGeneral } from '@vx/libs/fixtures/src';
import { AnyContest } from '@vx/libs/types/src';

const CONTEST_TEMPLATE: AnyContest = electionGeneral.contests[0];

export function generateContests(count: number): AnyContest[] {
  const contests: AnyContest[] = [];

  for (let i = 0; i < count; i += 1) {
    contests.push({
      ...CONTEST_TEMPLATE,
      id: `${i}`,
      title: `[TEST ${i}] ${CONTEST_TEMPLATE.title}`,
    });
  }

  return contests;
}

test('generates contests', () => {
  const contests = generateContests(2);
  expect(contests[0]).not.toEqual(contests[1]);
});
