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
import { DateWithoutTime } from '@vx/libs/basics/src';
import { electionFamousNames2021Fixtures } from '@vx/libs/fixtures/src';
import {
  DEFAULT_SYSTEM_SETTINGS,
  DistrictId,
  Election,
  ElectionId,
} from '@vx/libs/types/src';
import {
  BooleanEnvironmentVariableName,
  getFeatureFlagMock,
} from '@vx/libs/utils/src';
import { mockOf } from '@vx/libs/test-utils/src';
import { testSetupHelpers } from '../../test/helpers';
import {
  BallotStyle,
  Precinct,
  convertToVxfBallotStyle,
} from '../../src/types';
import { generateBallotStyles } from '../../src/ballot_styles';
import { ElectionRecord } from '../../src';
import { getTempBallotLanguageConfigsForCert } from '../../src/store';
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

test('CRUD elections', async () => {
  const { apiClient } = setupApp();
  expect(await apiClient.listElections()).toEqual([]);

  const expectedElectionId = 'election-1' as ElectionId;
  const electionId = (
    await apiClient.createElection({ id: expectedElectionId })
  ).unsafeUnwrap();
  expect(electionId).toEqual(expectedElectionId);

  const election = await apiClient.getElection({ electionId });
  // New elections should be blank
  expect(election).toEqual({
    election: {
      id: expectedElectionId,
      ballotLayout: {
        metadataEncoding: 'qr-code',
        paperSize: 'letter',
      },
      ballotStyles: [],
      contests: [],
      county: {
        id: '',
        name: '',
      },
      date: expect.any(DateWithoutTime),
      districts: [],
      parties: [],
      precincts: [],
      seal: '',
      state: '',
      title: '',
      type: 'general',
      ballotStrings: {},
    },
    systemSettings: DEFAULT_SYSTEM_SETTINGS,
    ballotStyles: [],
    precincts: [],
    createdAt: expect.any(String),
    ballotLanguageConfigs: getTempBallotLanguageConfigsForCert(),
  });

  expect(await apiClient.listElections()).toEqual([election]);

  const election2Definition =
    electionFamousNames2021Fixtures.electionDefinition;
  const electionId2 = (
    await apiClient.loadElection({
      electionData: election2Definition.electionData,
    })
  ).unsafeUnwrap();
  expect(electionId2).toEqual(election2Definition.election.id);

  const election2 = await apiClient.getElection({ electionId: electionId2 });

  const expectedPrecincts: Precinct[] =
    election2Definition.election.precincts.map((vxfPrecinct) => ({
      id: vxfPrecinct.id,
      name: vxfPrecinct.name,
      districtIds: ['district-1' as DistrictId],
    }));
  const expectedBallotStyles: BallotStyle[] = generateBallotStyles({
    ballotLanguageConfigs: election2.ballotLanguageConfigs,
    contests: election2Definition.election.contests,
    electionType: election2Definition.election.type,
    parties: election2Definition.election.parties,
    precincts: expectedPrecincts,
  });

  expect(election2).toEqual<ElectionRecord>({
    election: {
      ...election2Definition.election,
      ballotStyles: expectedBallotStyles.map(convertToVxfBallotStyle),
    },
    systemSettings: DEFAULT_SYSTEM_SETTINGS,
    // TODO test that ballot styles/precincts are correct
    ballotStyles: expectedBallotStyles,
    precincts: expectedPrecincts,
    createdAt: expect.any(String),
    ballotLanguageConfigs: getTempBallotLanguageConfigsForCert(),
  });

  expect(await apiClient.listElections()).toEqual([election, election2]);

  const updatedElection: Election = {
    ...election.election,
    title: 'Updated Election',
    type: 'primary',
  };

  await apiClient.updateElection({
    electionId,
    election: updatedElection,
  });

  expect(await apiClient.getElection({ electionId })).toEqual({
    ...election,
    election: updatedElection,
  });

  await apiClient.deleteElection({ electionId });

  expect(await apiClient.listElections()).toEqual([election2]);
});
