import { DateWithoutTime } from '@vx/libs/basics/src';
import { constructElectionKey } from './auth';
import { election } from '../../test/election';

test('constructElectionKey', () => {
  expect(constructElectionKey(election)).toEqual({
    id: 'election-1',
    date: new DateWithoutTime('2020-11-03'),
  });
});
