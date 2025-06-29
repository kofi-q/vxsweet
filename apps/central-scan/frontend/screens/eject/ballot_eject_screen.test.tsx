import { mockBaseLogger, LogEventId } from '@vx/libs/logging/src';
import {
  AdjudicationReason,
  type BallotMetadata,
  type BallotStyleId,
  BallotType,
  DEFAULT_SYSTEM_SETTINGS,
  formatBallotHash,
} from '@vx/libs/types/elections';
import { Scan } from '@vx/libs/api/src';
import { typedAs } from '@vx/libs/basics/types';
import fetchMock from 'fetch-mock';
import userEvent from '@testing-library/user-event';
import { hasTextAcrossElements } from '@vx/libs/test-utils/src';
import * as electionGeneral from '@vx/libs/fixtures/src/data/electionGeneral/election.json';
import { screen } from '../../test/react_testing_library';
import { renderInAppContext } from '../../test/render_in_app_context';
import { BallotEjectScreen } from './ballot_eject_screen';
import { createApiMock, type ApiMock } from '../../test/api';
const electionGeneralDefinition = electionGeneral.toElectionDefinition();

let apiMock: ApiMock;

beforeEach(() => {
  apiMock = createApiMock();
  apiMock.expectGetSystemSettings();
});

afterEach(() => {
  apiMock.assertComplete();
});

test('says the sheet is unreadable if it is', async () => {
  fetchMock.getOnce(
    '/central-scanner/scan/hmpb/review/next-sheet',
    typedAs<Scan.GetNextReviewSheetResponse>({
      interpreted: {
        id: 'mock-sheet-id',
        front: {
          image: { url: '/front/url' },
          interpretation: { type: 'BlankPage' },
        },
        back: {
          image: { url: '/back/url' },
          interpretation: { type: 'BlankPage' },
        },
      },
      layouts: {},
      definitions: {},
    })
  );

  const logger = mockBaseLogger();

  renderInAppContext(<BallotEjectScreen isTestMode />, { apiMock, logger });

  await screen.findByText('Unreadable');
  screen.getByText('The last scanned ballot was not tabulated.');
  screen.getByText(
    'There was a problem reading the ballot. Remove ballot and reload in the scanner to try again.'
  );
  expect(screen.getByRole('button').textContent).toEqual(
    'Ballot has been removed'
  );

  expect(logger.log).toHaveBeenCalledTimes(1);
  expect(logger.log).toHaveBeenCalledWith(
    LogEventId.ScanAdjudicationInfo,
    'election_manager',
    expect.objectContaining({
      adjudicationTypes: 'BlankPage',
    })
  );
  apiMock.expectContinueScanning({ forceAccept: false });
  userEvent.click(screen.getByText('Ballot has been removed'));
});

test('says the ballot sheet is overvoted if it is', async () => {
  const metadata: BallotMetadata = {
    ballotStyleId: '1' as BallotStyleId,
    precinctId: '1',
    ballotType: BallotType.Precinct,
    ballotHash: 'abcde',
    isTestMode: false,
  };
  fetchMock.getOnce(
    '/central-scanner/scan/hmpb/review/next-sheet',
    typedAs<Scan.GetNextReviewSheetResponse>({
      interpreted: {
        id: 'mock-sheet-id',
        front: {
          image: { url: '/front/url' },
          interpretation: {
            type: 'InterpretedHmpbPage',
            markInfo: {
              ballotSize: { width: 1, height: 1 },
              marks: [],
            },
            metadata: {
              ...metadata,
              pageNumber: 1,
            },
            adjudicationInfo: {
              requiresAdjudication: true,
              enabledReasonInfos: [
                {
                  type: AdjudicationReason.Overvote,
                  contestId: '1',
                  optionIds: ['1', '2'],
                  expected: 1,
                },
              ],
              ignoredReasonInfos: [],
              enabledReasons: [AdjudicationReason.Overvote],
            },
            votes: {},
            layout: {
              pageSize: { width: 1, height: 1 },
              metadata: {
                ...metadata,
                pageNumber: 1,
              },
              contests: [],
            },
          },
        },
        back: {
          image: { url: '/back/url' },
          interpretation: {
            type: 'InterpretedHmpbPage',
            markInfo: {
              ballotSize: { width: 1, height: 1 },
              marks: [],
            },
            metadata: {
              ...metadata,
              pageNumber: 2,
            },
            adjudicationInfo: {
              requiresAdjudication: false,
              enabledReasonInfos: [],
              ignoredReasonInfos: [],
              enabledReasons: [AdjudicationReason.Overvote],
            },
            votes: {},
            layout: {
              pageSize: { width: 1, height: 1 },
              metadata: {
                ...metadata,
                pageNumber: 2,
              },
              contests: [],
            },
          },
        },
      },
      layouts: {},
      definitions: {},
    })
  );

  const logger = mockBaseLogger();

  renderInAppContext(<BallotEjectScreen isTestMode />, { apiMock, logger });

  await screen.findByText('Overvote');
  screen.getByText(
    'The last scanned ballot was not tabulated because an overvote was detected.'
  );

  expect(logger.log).toHaveBeenCalledTimes(1);
  expect(logger.log).toHaveBeenCalledWith(
    LogEventId.ScanAdjudicationInfo,
    'election_manager',
    expect.objectContaining({
      adjudicationTypes: 'Overvote',
    })
  );

  apiMock.expectContinueScanning({ forceAccept: false });
  userEvent.click(screen.getByText('Remove to adjudicate'));
  userEvent.click(screen.getByText('Ballot has been removed'));

  apiMock.expectContinueScanning({ forceAccept: true });
  userEvent.click(screen.getByText('Tabulate as is'));
  userEvent.click(screen.getByText('Yes, tabulate ballot as is'));
});

test('says the ballot sheet is undervoted if it is', async () => {
  const metadata: BallotMetadata = {
    ballotStyleId: '1' as BallotStyleId,
    precinctId: '1',
    ballotType: BallotType.Precinct,
    ballotHash: 'abcde',
    isTestMode: false,
  };
  fetchMock.getOnce(
    '/central-scanner/scan/hmpb/review/next-sheet',
    typedAs<Scan.GetNextReviewSheetResponse>({
      interpreted: {
        id: 'mock-sheet-id',
        front: {
          image: { url: '/front/url' },
          interpretation: {
            type: 'InterpretedHmpbPage',
            markInfo: {
              ballotSize: { width: 1, height: 1 },
              marks: [],
            },
            metadata: {
              ...metadata,
              pageNumber: 1,
            },
            adjudicationInfo: {
              requiresAdjudication: true,
              enabledReasonInfos: [
                {
                  type: AdjudicationReason.Undervote,
                  contestId: '1',
                  optionIds: [],
                  expected: 1,
                },
              ],
              ignoredReasonInfos: [],
              enabledReasons: [AdjudicationReason.Undervote],
            },
            votes: {},
            layout: {
              pageSize: { width: 1, height: 1 },
              metadata: {
                ...metadata,
                pageNumber: 1,
              },
              contests: [],
            },
          },
        },
        back: {
          image: { url: '/back/url' },
          interpretation: {
            type: 'InterpretedHmpbPage',
            markInfo: {
              ballotSize: { width: 1, height: 1 },
              marks: [],
            },
            metadata: {
              ...metadata,
              pageNumber: 2,
            },
            adjudicationInfo: {
              requiresAdjudication: false,
              enabledReasonInfos: [],
              ignoredReasonInfos: [],
              enabledReasons: [AdjudicationReason.Overvote],
            },
            votes: {},
            layout: {
              pageSize: { width: 1, height: 1 },
              metadata: {
                ...metadata,
                pageNumber: 2,
              },
              contests: [],
            },
          },
        },
      },
      layouts: {},
      definitions: {},
    })
  );

  const logger = mockBaseLogger();

  renderInAppContext(<BallotEjectScreen isTestMode />, { apiMock, logger });

  await screen.findByText('Undervote');
  screen.getByText(
    'The last scanned ballot was not tabulated because an undervote was detected.'
  );

  expect(logger.log).toHaveBeenCalledTimes(1);
  expect(logger.log).toHaveBeenCalledWith(
    LogEventId.ScanAdjudicationInfo,
    'election_manager',
    expect.objectContaining({
      adjudicationTypes: 'Undervote',
    })
  );

  apiMock.expectContinueScanning({ forceAccept: false });
  userEvent.click(screen.getByText('Remove to adjudicate'));
  userEvent.click(screen.getByText('Ballot has been removed'));

  apiMock.expectContinueScanning({ forceAccept: true });

  userEvent.click(screen.getByText('Tabulate as is'));
  userEvent.click(screen.getByText('Yes, tabulate ballot as is'));
});

test('says the ballot sheet is blank if it is', async () => {
  const metadata: BallotMetadata = {
    ballotStyleId: '1' as BallotStyleId,
    precinctId: '1',
    ballotType: BallotType.Precinct,
    ballotHash: 'abcde',
    isTestMode: false,
  };
  fetchMock.getOnce(
    '/central-scanner/scan/hmpb/review/next-sheet',
    typedAs<Scan.GetNextReviewSheetResponse>({
      interpreted: {
        id: 'mock-sheet-id',
        front: {
          image: { url: '/front/url' },
          interpretation: {
            type: 'InterpretedHmpbPage',
            markInfo: {
              ballotSize: { width: 1, height: 1 },
              marks: [],
            },
            metadata: {
              ...metadata,
              pageNumber: 1,
            },
            adjudicationInfo: {
              requiresAdjudication: true,
              enabledReasonInfos: [
                {
                  type: AdjudicationReason.Undervote,
                  contestId: '1',
                  expected: 1,
                  optionIds: [],
                },
                { type: AdjudicationReason.BlankBallot },
              ],
              ignoredReasonInfos: [],
              enabledReasons: [
                AdjudicationReason.BlankBallot,
                AdjudicationReason.Undervote,
              ],
            },
            votes: {},
            layout: {
              pageSize: { width: 1, height: 1 },
              metadata: {
                ...metadata,
                pageNumber: 1,
              },
              contests: [],
            },
          },
        },
        back: {
          image: { url: '/back/url' },
          interpretation: {
            type: 'InterpretedHmpbPage',
            markInfo: {
              ballotSize: { width: 1, height: 1 },
              marks: [],
            },
            metadata: {
              ...metadata,
              pageNumber: 2,
            },
            adjudicationInfo: {
              requiresAdjudication: true,
              enabledReasonInfos: [{ type: AdjudicationReason.BlankBallot }],
              ignoredReasonInfos: [],
              enabledReasons: [
                AdjudicationReason.BlankBallot,
                AdjudicationReason.Undervote,
              ],
            },
            votes: {},
            layout: {
              pageSize: { width: 1, height: 1 },
              metadata: {
                ...metadata,
                pageNumber: 2,
              },
              contests: [],
            },
          },
        },
      },
      layouts: {},
      definitions: {},
    })
  );

  const logger = mockBaseLogger();

  renderInAppContext(<BallotEjectScreen isTestMode />, { apiMock, logger });

  await screen.findByText('Blank Ballot');
  screen.getByText(
    'The last scanned ballot was not tabulated because no votes were detected.'
  );

  expect(logger.log).toHaveBeenCalledTimes(1);
  expect(logger.log).toHaveBeenCalledWith(
    LogEventId.ScanAdjudicationInfo,
    'election_manager',
    expect.objectContaining({
      adjudicationTypes: 'BlankBallot, Undervote',
    })
  );

  apiMock.expectContinueScanning({ forceAccept: false });
  userEvent.click(screen.getByText('Remove to adjudicate'));
  userEvent.click(screen.getByText('Ballot has been removed'));

  apiMock.expectContinueScanning({ forceAccept: true });
  userEvent.click(screen.getByText('Tabulate as is'));
  userEvent.click(screen.getByText('Yes, tabulate ballot as is'));
});

test('calls out official ballot sheets in test mode', async () => {
  fetchMock.getOnce(
    '/central-scanner/scan/hmpb/review/next-sheet',
    typedAs<Scan.GetNextReviewSheetResponse>({
      interpreted: {
        id: 'mock-sheet-id',
        front: {
          image: { url: '/front/url' },
          interpretation: {
            type: 'InvalidTestModePage',
            metadata: {
              ballotStyleId: '1' as BallotStyleId,
              precinctId: '1',
              ballotType: BallotType.Precinct,
              ballotHash: 'abcde',
              isTestMode: false,
              pageNumber: 1,
            },
          },
        },
        back: {
          image: { url: '/back/url' },
          interpretation: {
            type: 'InvalidTestModePage',
            metadata: {
              ballotStyleId: '1' as BallotStyleId,
              precinctId: '1',
              ballotType: BallotType.Precinct,
              ballotHash: 'abcde',
              isTestMode: false,
              pageNumber: 2,
            },
          },
        },
      },
      layouts: {},
      definitions: {},
    })
  );

  const logger = mockBaseLogger();

  renderInAppContext(<BallotEjectScreen isTestMode />, { apiMock, logger });

  await screen.findByText('Official Ballot');
  screen.getByText('The last scanned ballot was not tabulated.');
  screen.getByText('Remove the official ballot before continuing.');
  expect(screen.getByRole('button').textContent).toEqual(
    'Ballot has been removed'
  );

  expect(logger.log).toHaveBeenCalledTimes(1);
  expect(logger.log).toHaveBeenCalledWith(
    LogEventId.ScanAdjudicationInfo,
    'election_manager',
    expect.objectContaining({
      adjudicationTypes: 'InvalidTestModePage',
    })
  );

  apiMock.expectContinueScanning({ forceAccept: false });
  userEvent.click(screen.getByText('Ballot has been removed'));
});

test('calls out test ballot sheets in live mode', async () => {
  fetchMock.getOnce(
    '/central-scanner/scan/hmpb/review/next-sheet',
    typedAs<Scan.GetNextReviewSheetResponse>({
      interpreted: {
        id: 'mock-sheet-id',
        front: {
          image: { url: '/front/url' },
          interpretation: {
            type: 'InvalidTestModePage',
            metadata: {
              ballotStyleId: '1' as BallotStyleId,
              precinctId: '1',
              ballotType: BallotType.Precinct,
              ballotHash: 'abcde',
              isTestMode: false,
              pageNumber: 1,
            },
          },
        },
        back: {
          image: { url: '/back/url' },
          interpretation: {
            type: 'InvalidTestModePage',
            metadata: {
              ballotStyleId: '1' as BallotStyleId,
              precinctId: '1',
              ballotType: BallotType.Precinct,
              ballotHash: 'abcde',
              isTestMode: false,
              pageNumber: 2,
            },
          },
        },
      },
      layouts: {},
      definitions: {},
    })
  );

  const logger = mockBaseLogger();

  renderInAppContext(<BallotEjectScreen isTestMode={false} />, {
    apiMock,
    logger,
  });

  await screen.findByText('Test Ballot');
  screen.getByText('The last scanned ballot was not tabulated.');
  screen.getByText('Remove the test ballot before continuing.');
  expect(screen.getByRole('button').textContent).toEqual(
    'Ballot has been removed'
  );

  expect(logger.log).toHaveBeenCalledTimes(1);
  expect(logger.log).toHaveBeenCalledWith(
    LogEventId.ScanAdjudicationInfo,
    'election_manager',
    expect.objectContaining({
      adjudicationTypes: 'InvalidTestModePage',
    })
  );

  apiMock.expectContinueScanning({ forceAccept: false });
  userEvent.click(screen.getByText('Ballot has been removed'));
});

test('shows invalid election screen when appropriate', async () => {
  fetchMock.getOnce(
    '/central-scanner/scan/hmpb/review/next-sheet',
    typedAs<Scan.GetNextReviewSheetResponse>({
      interpreted: {
        id: 'mock-sheet-id',
        front: {
          image: { url: '/front/url' },
          interpretation: {
            type: 'InvalidBallotHashPage',
            actualBallotHash: 'this-is-a-hash-hooray',
            expectedBallotHash: 'something',
          },
        },
        back: {
          image: { url: '/back/url' },
          interpretation: { type: 'BlankPage' },
        },
      },
      layouts: {},
      definitions: {},
    })
  );

  const logger = mockBaseLogger();

  const { getByText, queryAllByText } = renderInAppContext(
    <BallotEjectScreen isTestMode={false} />,
    { apiMock, logger }
  );

  await screen.findByText('Wrong Election');
  getByText(hasTextAcrossElements('Ballot Election IDthis-is'));
  getByText(
    hasTextAcrossElements(
      `Scanner Election ID${formatBallotHash(
        electionGeneralDefinition.ballotHash
      )}`
    )
  );
  expect(queryAllByText('Tabulate as is').length).toEqual(0);
  expect(logger.log).toHaveBeenCalledTimes(1);
  expect(logger.log).toHaveBeenCalledWith(
    LogEventId.ScanAdjudicationInfo,
    'election_manager',
    expect.objectContaining({
      adjudicationTypes: 'InvalidBallotHashPage, BlankPage',
    })
  );

  apiMock.expectContinueScanning({ forceAccept: false });
  userEvent.click(screen.getByText('Ballot has been removed'));
});

test('does not allow tabulating the overvote if precinctScanDisallowCastingOvervotes is set', async () => {
  apiMock.apiClient.getSystemSettings.reset();
  apiMock.expectGetSystemSettings({
    ...DEFAULT_SYSTEM_SETTINGS,
    precinctScanDisallowCastingOvervotes: true,
  });
  const metadata: BallotMetadata = {
    ballotStyleId: '1' as BallotStyleId,
    precinctId: '1',
    ballotType: BallotType.Precinct,
    ballotHash: 'abcde',
    isTestMode: false,
  };
  fetchMock.getOnce(
    '/central-scanner/scan/hmpb/review/next-sheet',
    typedAs<Scan.GetNextReviewSheetResponse>({
      interpreted: {
        id: 'mock-sheet-id',
        front: {
          image: { url: '/front/url' },
          interpretation: {
            type: 'InterpretedHmpbPage',
            markInfo: {
              ballotSize: { width: 1, height: 1 },
              marks: [],
            },
            metadata: {
              ...metadata,
              pageNumber: 1,
            },
            adjudicationInfo: {
              requiresAdjudication: true,
              enabledReasonInfos: [
                {
                  type: AdjudicationReason.Overvote,
                  contestId: '1',
                  optionIds: ['1', '2'],
                  expected: 1,
                },
              ],
              ignoredReasonInfos: [],
              enabledReasons: [AdjudicationReason.Overvote],
            },
            votes: {},
            layout: {
              pageSize: { width: 1, height: 1 },
              metadata: {
                ...metadata,
                pageNumber: 1,
              },
              contests: [],
            },
          },
        },
        back: {
          image: { url: '/back/url' },
          interpretation: {
            type: 'InterpretedHmpbPage',
            markInfo: {
              ballotSize: { width: 1, height: 1 },
              marks: [],
            },
            metadata: {
              ...metadata,
              pageNumber: 2,
            },
            adjudicationInfo: {
              requiresAdjudication: false,
              enabledReasonInfos: [],
              ignoredReasonInfos: [],
              enabledReasons: [AdjudicationReason.Overvote],
            },
            votes: {},
            layout: {
              pageSize: { width: 1, height: 1 },
              metadata: {
                ...metadata,
                pageNumber: 2,
              },
              contests: [],
            },
          },
        },
      },
      layouts: {},
      definitions: {},
    })
  );

  const logger = mockBaseLogger();

  renderInAppContext(<BallotEjectScreen isTestMode />, { apiMock, logger });

  await screen.findByText('Overvote');
  screen.getByText(
    'The last scanned ballot was not tabulated because an overvote was detected.'
  );

  expect(screen.queryByText('Tabulate as is')).not.toBeInTheDocument();
  expect(screen.queryByText('Remove to adjudicate')).not.toBeInTheDocument();

  apiMock.expectContinueScanning({ forceAccept: false });
  userEvent.click(screen.getByText('Ballot has been removed'));
});
