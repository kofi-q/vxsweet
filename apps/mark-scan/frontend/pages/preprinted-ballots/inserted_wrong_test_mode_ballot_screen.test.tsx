jest.mock('../../api/api');

import { type BallotMetadata } from '@vx/libs/types/elections';
import { type PageInterpretation } from '@vx/libs/types/scanning';
import { mockOf, suppressingConsoleOutput } from '@vx/libs/test-utils/src';
import { TestErrorBoundary } from '@vx/libs/ui/errors';
import { UseQueryResult } from '@tanstack/react-query';
import { render } from '../../test/react_testing_library';
import * as api from '../../api/api';
import { InsertedWrongTestModeBallotScreen } from './inserted_wrong_test_mode_ballot_screen';

function setMockInterpretationQuery(params: {
  data?: Partial<PageInterpretation>;
  isSuccess: boolean;
}) {
  const { data, isSuccess } = params;

  mockOf(api.getInterpretation.useQuery).mockReturnValue({
    data: data as unknown as PageInterpretation,
    isSuccess,
  } as unknown as UseQueryResult<PageInterpretation>);
}

function setMockInterpretation(options: { isTestMode: boolean }) {
  const metadata: Partial<BallotMetadata> = { isTestMode: options.isTestMode };

  setMockInterpretationQuery({
    data: {
      metadata: metadata as unknown as BallotMetadata,
      type: 'InvalidTestModePage',
    },
    isSuccess: true,
  });
}

function setUnsupportedMockInterpretation() {
  setMockInterpretationQuery({
    data: { type: 'InvalidBallotHashPage' },
    isSuccess: true,
  });
}

test('test ballot in live mode', () => {
  setMockInterpretation({ isTestMode: true });

  const { container } = render(
    <TestErrorBoundary>
      <InsertedWrongTestModeBallotScreen />
    </TestErrorBoundary>
  );

  expect(container).toHaveTextContent(/sheet contains a test ballot/i);
});

test('live ballot in test mode', () => {
  setMockInterpretation({ isTestMode: false });

  const { container } = render(
    <TestErrorBoundary>
      <InsertedWrongTestModeBallotScreen />
    </TestErrorBoundary>
  );

  expect(container).toHaveTextContent(/sheet contains an official ballot/i);
});

test('no contents while query is pending', () => {
  setMockInterpretationQuery({ isSuccess: false });

  const { container } = render(
    <TestErrorBoundary>
      <InsertedWrongTestModeBallotScreen />
    </TestErrorBoundary>
  );

  expect(container).toHaveTextContent('');
});

test('throws if rendered for the wrong interpretation type', () => {
  suppressingConsoleOutput(() => {
    setUnsupportedMockInterpretation();

    const { container } = render(
      <TestErrorBoundary>
        <InsertedWrongTestModeBallotScreen />
      </TestErrorBoundary>
    );

    expect(container).toHaveTextContent('Test Error Boundary');
  });
});
