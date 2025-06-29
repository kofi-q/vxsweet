jest.mock('../../api/api');

import { type BallotMetadata } from '@vx/libs/types/elections';
import {
  type PageInterpretation,
  type PageInterpretationType,
} from '@vx/libs/types/scanning';
import { mockOf, suppressingConsoleOutput } from '@vx/libs/test-utils/src';
import { TestErrorBoundary } from '@vx/libs/ui/errors';
import { UseQueryResult } from '@tanstack/react-query';
import { render, screen } from '../../test/react_testing_library';
import { ReinsertedInvalidBallotScreen } from './invalid_ballot';
import * as api from '../../api/api';

function setMockInterpretationQuery(params: {
  isSuccess: boolean;
  metadata?: Partial<BallotMetadata>;
  type?: PageInterpretationType;
}) {
  const { isSuccess, metadata, type } = params;

  mockOf(api.getInterpretation.useQuery).mockReturnValue({
    data: {
      metadata: metadata as unknown as BallotMetadata,
      type,
    } as unknown as PageInterpretation,
    isSuccess,
  } as unknown as UseQueryResult<PageInterpretation>);
}

function setMockInterpretation(type: PageInterpretationType) {
  setMockInterpretationQuery({
    isSuccess: true,
    metadata: { isTestMode: true },
    type,
  });
}

const expectedScreenContents: Readonly<
  Record<PageInterpretationType, string | RegExp>
> = {
  BlankPage: /no ballot detected/i,
  InterpretedBmdPage: 'Test Error Boundary',
  InterpretedHmpbPage: /no ballot detected/i,
  InvalidBallotHashPage: /wrong election/i,
  InvalidPrecinctPage: /wrong precinct/i,
  InvalidTestModePage: /wrong ballot mode/i,
  UnreadablePage: /no ballot detected/i,
};

for (const [interpretationType, expectedString] of Object.entries(
  expectedScreenContents
) as Array<[PageInterpretationType, string]>) {
  test(`'${interpretationType}' interpretation type`, () => {
    suppressingConsoleOutput(() => {
      setMockInterpretation(interpretationType);

      render(
        <TestErrorBoundary>
          <ReinsertedInvalidBallotScreen />
        </TestErrorBoundary>
      );

      screen.getByText(expectedString);
    });
  });
}

test('no contents while query is pending', () => {
  setMockInterpretationQuery({ isSuccess: false });

  const { container } = render(
    <TestErrorBoundary>
      <ReinsertedInvalidBallotScreen />
    </TestErrorBoundary>
  );

  expect(container).toHaveTextContent('');
});
