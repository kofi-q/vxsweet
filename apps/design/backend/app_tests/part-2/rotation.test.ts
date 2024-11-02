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
import { electionFamousNames2021Fixtures } from '@vx/libs/fixtures/src';
import { type CandidateContest } from '@vx/libs/types/src';
import {
  BooleanEnvironmentVariableName,
  getFeatureFlagMock,
} from '@vx/libs/utils/src';
import { mockOf } from '@vx/libs/test-utils/src';
import { testSetupHelpers } from '../../test/helpers';
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

test('Updating contests with candidate rotation', async () => {
  const { apiClient } = setupApp();
  const electionId = (
    await apiClient.loadElection({
      electionData:
        electionFamousNames2021Fixtures.electionDefinition.electionData,
    })
  ).unsafeUnwrap();
  const electionRecord = await apiClient.getElection({ electionId });
  const contest = electionRecord.election.contests.find(
    (c): c is CandidateContest =>
      c.type === 'candidate' && c.candidates.length > 2
  )!;
  expect(contest.candidates.map((c) => c.name)).toMatchInlineSnapshot(`
[
  "Winston Churchill",
  "Oprah Winfrey",
  "Louis Armstrong",
]
`);

  // Update with no changes just to trigger candidate rotation
  await apiClient.updateElection({
    electionId,
    election: electionRecord.election,
  });

  const updatedElectionRecord = await apiClient.getElection({ electionId });
  const updatedContest = updatedElectionRecord.election.contests.find(
    (c): c is CandidateContest => c.id === contest.id
  )!;
  expect(updatedContest.candidates.map((c) => c.name)).toMatchInlineSnapshot(`
[
  "Louis Armstrong",
  "Winston Churchill",
  "Oprah Winfrey",
]
`);

  // Rotation logic is tested in candidate_rotation.test.ts
  // Here we just want to make sure that rotation occurred.
  expect(updatedContest.candidates).not.toEqual(contest.candidates);
  expect(updatedContest.candidates.length).toEqual(contest.candidates.length);
  expect(new Set(updatedContest.candidates)).toEqual(
    new Set(contest.candidates)
  );
});
