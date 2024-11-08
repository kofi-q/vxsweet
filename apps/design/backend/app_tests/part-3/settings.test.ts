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
import {
  AdjudicationReason,
  DEFAULT_SYSTEM_SETTINGS,
  type ElectionId,
  type SystemSettings,
} from '@vx/libs/types/elections';
import {
  BooleanEnvironmentVariableName,
  getFeatureFlagMock,
} from '@vx/libs/utils/src';
import { mockOf } from '@vx/libs/test-utils/src';
import { newTestApi } from '../../test/helpers';
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

test('Update system settings', () => {
  const { api } = newTestApi();
  const electionId = 'election-1' as ElectionId;
  api.createElection({ id: electionId }).unsafeUnwrap();
  const electionRecord = api.getElection({ electionId });

  expect(electionRecord.systemSettings).toEqual(DEFAULT_SYSTEM_SETTINGS);

  const updatedSystemSettings: SystemSettings = {
    ...electionRecord.systemSettings,
    markThresholds: {
      definite: 0.9,
      marginal: 0.8,
    },
    precinctScanAdjudicationReasons: [AdjudicationReason.Overvote],
    centralScanAdjudicationReasons: [
      AdjudicationReason.Undervote,
      AdjudicationReason.MarginalMark,
    ],
  };
  expect(updatedSystemSettings).not.toEqual(DEFAULT_SYSTEM_SETTINGS);

  api.updateSystemSettings({
    electionId,
    systemSettings: updatedSystemSettings,
  });

  expect(api.getElection({ electionId })).toEqual({
    ...electionRecord,
    systemSettings: updatedSystemSettings,
  });
});
