jest.mock('@vx/libs/utils/src', (): typeof import('@vx/libs/utils/src') => {
  return {
    ...jest.requireActual('@vx/libs/utils/src'),
    isFeatureFlagEnabled: (flag) => mockFeatureFlagger.isEnabled(flag),
  };
});

jest.mock('../../src/ballot_style_reports');

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
import {
  BooleanEnvironmentVariableName,
  getFeatureFlagMock,
} from '@vx/libs/utils/src';
import { readElectionPackageFromFile } from '@vx/libs/backend/src';
import { mockOf } from '@vx/libs/test-utils/src';
import { exportElectionPackage, testSetupHelpers } from '../../test/helpers';
import { renderBallotStyleReadinessReport } from '../../src/ballot_style_reports';

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

test('Consistency of ballot hash across exports', async () => {
  // This test runs unnecessarily long if we're generating exports for all
  // languages, so disabling multi-language support for this case:
  mockFeatureFlagger.disableFeatureFlag(
    BooleanEnvironmentVariableName.ENABLE_CLOUD_TRANSLATION_AND_SPEECH_SYNTHESIS
  );

  const baseElectionDefinition =
    electionFamousNames2021Fixtures.electionDefinition;
  const { apiClient, workspace } = setupApp();

  const electionId = (
    await apiClient.loadElection({
      electionData: baseElectionDefinition.electionData,
    })
  ).unsafeUnwrap();

  const allBallotsOutput = await apiClient.exportAllBallots({
    electionId,
    electionSerializationFormat: 'vxf',
  });

  const testDecksOutput = await apiClient.exportTestDecks({
    electionId,
    electionSerializationFormat: 'vxf',
  });

  const electionPackageFilePath = await exportElectionPackage({
    apiClient,
    electionId,
    workspace,
    electionSerializationFormat: 'vxf',
  });
  const { electionDefinition } = (
    await readElectionPackageFromFile(electionPackageFilePath)
  ).unsafeUnwrap().electionPackage;

  expect([
    ...new Set([
      allBallotsOutput.ballotHash,
      testDecksOutput.ballotHash,
      electionDefinition.ballotHash,
    ]),
  ]).toHaveLength(1);
});
