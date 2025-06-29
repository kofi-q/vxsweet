import { LogEventId, mockLogger } from '@vx/libs/logging/src';
import { err } from '@vx/libs/basics/result';
import { openPolls } from './polls';
import { Store } from '../store/store';

test('opening polls fails if ballots have already been scanned', () => {
  const logger = mockLogger();
  const store = Store.memoryStore();
  jest.spyOn(store, 'getBallotsCounted').mockReturnValue(1);

  const openPollsResult = openPolls({
    store,
    logger,
  });

  expect(openPollsResult).toEqual(err('ballots-already-scanned'));
  expect(logger.logAsCurrentRole).toHaveBeenCalledWith(
    LogEventId.PollsOpened,
    expect.objectContaining({
      disposition: 'failure',
      message:
        'User prevented from opening polls because ballots have already been scanned.',
      sheetCount: 1,
    })
  );
});
