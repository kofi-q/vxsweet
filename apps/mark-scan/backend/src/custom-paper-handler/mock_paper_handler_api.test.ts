jest.mock(
  '@vx/libs/custom-paper-handler/src',
  (): typeof import('@vx/libs/custom-paper-handler/src') => ({
    ...jest.requireActual('@vx/libs/custom-paper-handler/src'),
    isMockPaperHandler: jest.fn() as unknown as typeof isMockPaperHandler,
  })
);

import {
  MockPaperHandlerDriver,
  MockPaperHandlerStatus,
  isMockPaperHandler,
} from '@vx/libs/custom-paper-handler/src';
import { mockOf } from '@vx/libs/test-utils/src';
import { buildMockPaperHandlerApi } from './mock_paper_handler_api';


beforeEach(() => {
  mockOf(isMockPaperHandler).mockReturnValue(true);
});

test('getMockPaperHandlerStatus', () => {
  const paperHandler = new MockPaperHandlerDriver();
  const api = buildMockPaperHandlerApi({ paperHandler });

  expect(api.getMockPaperHandlerStatus()).toEqual<MockPaperHandlerStatus>(
    'noPaper'
  );

  paperHandler.setMockStatus('paperParked');
  expect(api.getMockPaperHandlerStatus()).toEqual<MockPaperHandlerStatus>(
    'paperParked'
  );

  // Expect no-op for non-mock paper handler:
  mockOf(isMockPaperHandler).mockReturnValue(false);
  expect(api.getMockPaperHandlerStatus()).toBeUndefined();
});

test('setMockPaperHandlerStatus', () => {
  const paperHandler = new MockPaperHandlerDriver();
  const api = buildMockPaperHandlerApi({ paperHandler });

  expect(paperHandler.getMockStatus()).toEqual<MockPaperHandlerStatus>(
    'noPaper'
  );

  api.setMockPaperHandlerStatus({ mockStatus: 'paperInserted' });
  expect(paperHandler.getMockStatus()).toEqual<MockPaperHandlerStatus>(
    'paperInserted'
  );

  // Expect no-op for non-mock paper handler:
  mockOf(isMockPaperHandler).mockReturnValue(false);
  api.setMockPaperHandlerStatus({ mockStatus: 'paperJammed' });
  expect(paperHandler.getMockStatus()).toEqual<MockPaperHandlerStatus>(
    'paperInserted'
  );
});
