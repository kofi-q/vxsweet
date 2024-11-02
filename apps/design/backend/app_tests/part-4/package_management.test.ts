jest.mock('@vx/libs/utils/src', (): typeof import('@vx/libs/utils/src') => {
  return {
    ...jest.requireActual('@vx/libs/utils/src'),
    isFeatureFlagEnabled: (flag) => mockFeatureFlagger.isEnabled(flag),
  };
});

jest.mock('../../ballot-styles/ballot_style_reports');

jest.mock('@vx/libs/hmpb/src', () => {
  const original = jest.requireActual('@vx/libs/hmpb/src');
  return {
    ...original,
    renderAllBallotsAndCreateElectionDefinition: jest.fn(
      original.renderAllBallotsAndCreateElectionDefinition
    ),
  };
});

import { Buffer } from 'node:buffer';
import { assertDefined } from '@vx/libs/basics/src';
import { electionFamousNames2021Fixtures } from '@vx/libs/fixtures/src';
import { HmpbBallotPaperSize } from '@vx/libs/types/src';
import {
  BooleanEnvironmentVariableName,
  getFeatureFlagMock,
} from '@vx/libs/utils/src';
import { mockOf } from '@vx/libs/test-utils/src';
import {
  ELECTION_PACKAGE_FILE_NAME_REGEX,
  processNextBackgroundTaskIfAny,
  testSetupHelpers,
} from '../../test/helpers';
import { renderBallotStyleReadinessReport } from '../../ballot-styles/ballot_style_reports';

jest.setTimeout(60_000);

const mockFeatureFlagger = getFeatureFlagMock();

const { setupApp, cleanup } = testSetupHelpers();

const MOCK_READINESS_REPORT_CONTENTS = '%PDF - MockReadinessReport';
const MOCK_READINESS_REPORT_PDF = Buffer.from(
  MOCK_READINESS_REPORT_CONTENTS,
  'utf-8'
);

afterAll(cleanup);

beforeEach(() => {
  mockFeatureFlagger.resetFeatureFlags();
  mockFeatureFlagger.enableFeatureFlag(
    BooleanEnvironmentVariableName.ENABLE_CLOUD_TRANSLATION_AND_SPEECH_SYNTHESIS
  );

  mockOf(renderBallotStyleReadinessReport).mockResolvedValue(
    MOCK_READINESS_REPORT_PDF
  );
});

test('Election package management', async () => {
  const baseElectionDefinition =
    electionFamousNames2021Fixtures.electionDefinition;
  const { apiClient, workspace } = setupApp();

  const electionId = (
    await apiClient.loadElection({
      electionData: baseElectionDefinition.electionData,
    })
  ).unsafeUnwrap();
  const election = await apiClient.getElection({ electionId });

  // Without mocking all the translations some ballot styles for non-English languages don't fit on a letter
  // page for this election. To get around this we use legal paper size for the purposes of this test.
  await apiClient.updateElection({
    electionId,
    election: {
      ...election.election,
      ballotLayout: {
        ...election.election.ballotLayout,
        paperSize: HmpbBallotPaperSize.Legal,
      },
    },
  });

  const electionPackageBeforeExport = await apiClient.getElectionPackage({
    electionId,
  });
  expect(electionPackageBeforeExport).toEqual({});

  // Initiate an export
  await apiClient.exportElectionPackage({
    electionId,
    electionSerializationFormat: 'vxf',
  });
  const expectedPayload = `{"electionId":"${electionId}","electionSerializationFormat":"vxf"}`;
  const electionPackageAfterInitiatingExport =
    await apiClient.getElectionPackage({ electionId });
  expect(electionPackageAfterInitiatingExport).toEqual({
    task: {
      createdAt: expect.any(Date),
      id: expect.any(String),
      payload: expectedPayload,
      taskName: 'generate_election_package',
    },
  });
  const taskId = assertDefined(electionPackageAfterInitiatingExport.task).id;

  // Check that initiating an export before a prior has completed doesn't trigger a new background
  // task (even with a different serialization format)
  await apiClient.exportElectionPackage({
    electionId,
    electionSerializationFormat: 'cdf',
  });
  const electionPackageAfterInitiatingRedundantExport =
    await apiClient.getElectionPackage({ electionId });
  expect(electionPackageAfterInitiatingRedundantExport).toEqual(
    electionPackageAfterInitiatingExport
  );

  // Complete an export
  await processNextBackgroundTaskIfAny(workspace);
  const electionPackageAfterExport = await apiClient.getElectionPackage({
    electionId,
  });
  expect(electionPackageAfterExport).toEqual({
    task: {
      completedAt: expect.any(Date),
      createdAt: expect.any(Date),
      id: taskId,
      payload: expectedPayload,
      startedAt: expect.any(Date),
      taskName: 'generate_election_package',
    },
    url: expect.stringMatching(ELECTION_PACKAGE_FILE_NAME_REGEX),
  });

  // Check that initiating an export after a prior has completed does trigger a new background task
  await apiClient.exportElectionPackage({
    electionId,
    electionSerializationFormat: 'vxf',
  });
  const electionPackageAfterInitiatingSecondExport =
    await apiClient.getElectionPackage({ electionId });
  expect(electionPackageAfterInitiatingSecondExport).toEqual({
    task: {
      createdAt: expect.any(Date),
      id: expect.any(String),
      payload: expectedPayload,
      taskName: 'generate_election_package',
    },
    url: expect.stringMatching(ELECTION_PACKAGE_FILE_NAME_REGEX),
  });
  const secondTaskId = assertDefined(
    electionPackageAfterInitiatingSecondExport.task
  ).id;
  expect(secondTaskId).not.toEqual(taskId);
});
