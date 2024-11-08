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
import { assertDefined } from '@vx/libs/basics/assert';
import { electionFamousNames2021Fixtures } from '@vx/libs/fixtures/src';
import { HmpbBallotPaperSize } from '@vx/libs/types/elections';
import {
  BooleanEnvironmentVariableName,
  getFeatureFlagMock,
} from '@vx/libs/utils/src';
import { mockOf } from '@vx/libs/test-utils/src';
import {
  ELECTION_PACKAGE_FILE_NAME_REGEX,
  newTestApi,
  processNextBackgroundTaskIfAny,
} from '../../test/helpers';
import { renderBallotStyleReadinessReport } from '../../ballot-styles/ballot_style_reports';

jest.setTimeout(60_000);

const mockFeatureFlagger = getFeatureFlagMock();

const MOCK_READINESS_REPORT_CONTENTS = '%PDF - MockReadinessReport';
const MOCK_READINESS_REPORT_PDF = Buffer.from(
  MOCK_READINESS_REPORT_CONTENTS,
  'utf-8'
);

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
  const { api, workspace } = newTestApi();

  const electionId = api
    .loadElection({
      electionData: baseElectionDefinition.electionData,
    })
    .unsafeUnwrap();
  const election = api.getElection({ electionId });

  // Without mocking all the translations some ballot styles for non-English languages don't fit on a letter
  // page for this election. To get around this we use legal paper size for the purposes of this test.
  api.updateElection({
    electionId,
    election: {
      ...election.election,
      ballotLayout: {
        ...election.election.ballotLayout,
        paperSize: HmpbBallotPaperSize.Legal,
      },
    },
  });

  const electionPackageBeforeExport = api.getElectionPackage({
    electionId,
  });
  expect(electionPackageBeforeExport).toEqual({});

  // Initiate an export
  api.exportElectionPackage({
    electionId,
    electionSerializationFormat: 'vxf',
  });
  const expectedPayload = `{"electionId":"${electionId}","electionSerializationFormat":"vxf"}`;
  const electionPackageAfterInitiatingExport = api.getElectionPackage({
    electionId,
  });
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
  api.exportElectionPackage({
    electionId,
    electionSerializationFormat: 'cdf',
  });
  const electionPackageAfterInitiatingRedundantExport = api.getElectionPackage({
    electionId,
  });
  expect(electionPackageAfterInitiatingRedundantExport).toEqual(
    electionPackageAfterInitiatingExport
  );

  // Complete an export
  await processNextBackgroundTaskIfAny(workspace);
  const electionPackageAfterExport = api.getElectionPackage({
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
  api.exportElectionPackage({
    electionId,
    electionSerializationFormat: 'vxf',
  });
  const electionPackageAfterInitiatingSecondExport = api.getElectionPackage({
    electionId,
  });
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
