import { DateWithoutTime } from '@vx/libs/basics/time';
import { constructElectionKey } from './auth';
import { election } from '../../test/election';

test('constructElectionKey', () => {
  expect(constructElectionKey(election)).toEqual({
    id: 'election-1',
    date: new DateWithoutTime('2020-11-03'),
  });
});
