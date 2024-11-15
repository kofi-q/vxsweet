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
import * as electionFamousNames2021Fixtures from '@vx/libs/fixtures/src/data/electionFamousNames2021';
import {
  BooleanEnvironmentVariableName,
  getFeatureFlagMock,
} from '@vx/libs/utils/src';
import { readElectionPackageFromFile } from '@vx/libs/backend/election_package';
import { mockOf } from '@vx/libs/test-utils/src';
import { exportElectionPackage, newTestApi } from '../../test/helpers';
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

test('Consistency of ballot hash across exports', async () => {
  // This test runs unnecessarily long if we're generating exports for all
  // languages, so disabling multi-language support for this case:
  mockFeatureFlagger.disableFeatureFlag(
    BooleanEnvironmentVariableName.ENABLE_CLOUD_TRANSLATION_AND_SPEECH_SYNTHESIS
  );

  const baseElectionDefinition =
    electionFamousNames2021Fixtures.electionJson.toElectionDefinition();
  const { api, workspace } = newTestApi();

  const electionId = api
    .loadElection({
      electionData: baseElectionDefinition.electionData,
    })
    .unsafeUnwrap();

  const allBallotsOutput = await api.exportAllBallots({
    electionId,
    electionSerializationFormat: 'vxf',
  });

  const testDecksOutput = await api.exportTestDecks({
    electionId,
    electionSerializationFormat: 'vxf',
  });

  const electionPackageFilePath = await exportElectionPackage({
    api,
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
