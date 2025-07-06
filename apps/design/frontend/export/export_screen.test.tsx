jest.mock('js-file-download');

jest.mock('../util/utils', (): typeof import('../util/utils') => ({
  ...jest.requireActual('../util/utils'),
  downloadFile: jest.fn(),
}));

import { Buffer } from 'node:buffer';
import fileDownload from 'js-file-download';
import userEvent from '@testing-library/user-event';
import { mockOf } from '@vx/libs/test-utils/src';
import {
  provideApi,
  createMockApiClient,
  type MockApiClient,
} from '../test/api_helpers';
import { render, screen, waitFor } from '../test/react_testing_library';
import { withRoute } from '../test/routing_helpers';
import { ExportScreen } from './export_screen';
import { routes } from '../routes/routes';
import { downloadFile } from '../util/utils';
import { generalElectionRecord } from '../test/fixtures';

const electionId = generalElectionRecord.election.id;

const fileDownloadMock = jest.mocked(fileDownload);

let apiMock: MockApiClient;

beforeEach(() => {
  apiMock = createMockApiClient();
  apiMock.getElectionPackage.expectCallWith({ electionId }).resolves({});
});

afterEach(() => {
  apiMock.assertComplete();
});

function renderScreen() {
  render(
    provideApi(
      apiMock,
      withRoute(<ExportScreen />, {
        paramPath: routes.election(':electionId').export.path,
        path: routes.election(electionId).export.path,
      })
    )
  );
}

test('export all ballots', async () => {
  renderScreen();
  await screen.findByRole('heading', { name: 'Export' });

  apiMock.exportAllBallots
    .expectCallWith({ electionId, electionSerializationFormat: 'vxf' })
    .resolves({
      zipContents: Buffer.from('mock-zip-contents'),
      ballotHash: '1234567890abcdef',
    });

  userEvent.click(screen.getButton('Export All Ballots'));

  await waitFor(() => {
    expect(fileDownloadMock).toHaveBeenCalledWith(
      Buffer.from('mock-zip-contents'),
      'ballots-1234567.zip'
    );
  });
});

test('export test decks', async () => {
  renderScreen();
  await screen.findByRole('heading', { name: 'Export' });

  apiMock.exportTestDecks
    .expectCallWith({ electionId, electionSerializationFormat: 'vxf' })
    .resolves({
      zipContents: Buffer.from('mock-zip-contents'),
      ballotHash: '1234567890abcdef',
    });

  userEvent.click(screen.getButton('Export Test Decks'));

  await waitFor(() => {
    expect(fileDownloadMock).toHaveBeenCalledWith(
      Buffer.from('mock-zip-contents'),
      'test-decks-1234567.zip'
    );
  });
});

test('export election package', async () => {
  renderScreen();
  await screen.findByRole('heading', { name: 'Export' });

  const taskCreatedAt = new Date();
  apiMock.exportElectionPackage
    .expectCallWith({ electionId, electionSerializationFormat: 'vxf' })
    .resolves();

  apiMock.getElectionPackage.expectCallWith({ electionId }).resolves({
    task: {
      completedAt: new Date(taskCreatedAt.getTime() + 2000),
      createdAt: taskCreatedAt,
      id: '1',
      payload: JSON.stringify({ electionId }),
      startedAt: new Date(taskCreatedAt.getTime() + 1000),
      taskName: 'generate_election_package',
    },
    url: 'http://localhost:1234/election-package-1234567890.zip',
  });

  userEvent.click(screen.getButton('Export Election Package'));

  await waitFor(() => {
    expect(mockOf(downloadFile)).toHaveBeenCalledWith(
      'http://localhost:1234/election-package-1234567890.zip'
    );
  });
});

test('export election package error handling', async () => {
  renderScreen();
  await screen.findByRole('heading', { name: 'Export' });

  const taskCreatedAt = new Date();
  apiMock.exportElectionPackage
    .expectCallWith({ electionId, electionSerializationFormat: 'vxf' })
    .resolves();
  apiMock.getElectionPackage.expectCallWith({ electionId }).resolves({
    task: {
      completedAt: new Date(taskCreatedAt.getTime() + 2000),
      createdAt: taskCreatedAt,
      error: 'Whoa!',
      id: '1',
      payload: JSON.stringify({ electionId }),
      startedAt: new Date(taskCreatedAt.getTime() + 1000),
      taskName: 'generate_election_package',
    },
  });
  userEvent.click(screen.getButton('Export Election Package'));

  await screen.findByText('An unexpected error occurred. Please try again.');
  expect(mockOf(downloadFile)).not.toHaveBeenCalled();
});

test('using CDF', async () => {
  renderScreen();
  await screen.findByRole('heading', { name: 'Export' });

  userEvent.click(
    screen.getByRole('checkbox', {
      name: 'Format election using CDF',
      checked: false,
    })
  );
  screen.getByRole('checkbox', {
    name: 'Format election using CDF',
    checked: true,
  });

  apiMock.exportAllBallots
    .expectCallWith({ electionId, electionSerializationFormat: 'cdf' })
    .resolves({
      zipContents: Buffer.from('mock-zip-contents'),
      ballotHash: '1234567890abcdef',
    });
  userEvent.click(screen.getButton('Export All Ballots'));
  await waitFor(() => {
    expect(fileDownloadMock).toHaveBeenCalledWith(
      Buffer.from('mock-zip-contents'),
      'ballots-1234567.zip'
    );
  });

  apiMock.exportTestDecks
    .expectCallWith({ electionId, electionSerializationFormat: 'cdf' })
    .resolves({
      zipContents: Buffer.from('mock-zip-contents'),
      ballotHash: '1234567890abcdef',
    });
  userEvent.click(screen.getButton('Export Test Decks'));
  await waitFor(() => {
    expect(fileDownloadMock).toHaveBeenCalledWith(
      Buffer.from('mock-zip-contents'),
      'test-decks-1234567.zip'
    );
  });

  apiMock.exportElectionPackage
    .expectCallWith({ electionId, electionSerializationFormat: 'cdf' })
    .resolves();
  apiMock.getElectionPackage.expectRepeatedCallsWith({ electionId }).resolves({
    task: {
      createdAt: new Date(),
      id: '1',
      payload: JSON.stringify({
        electionId,
        electionSerializationFormat: 'cdf',
      }),
      taskName: 'generate_election_package',
    },
  });
  userEvent.click(screen.getButton('Export Election Package'));

  userEvent.click(
    screen.getByRole('checkbox', {
      name: 'Format election using CDF',
      checked: true,
    })
  );
  screen.getByRole('checkbox', {
    name: 'Format election using CDF',
    checked: false,
  });
});
