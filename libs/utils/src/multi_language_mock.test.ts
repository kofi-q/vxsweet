import * as electionGeneral from '@vx/libs/fixtures/src/data/electionGeneral/election.json';
import { LanguageCode } from '@vx/libs/types/languages';
import { getMockMultiLanguageElectionDefinition } from './multi_language_mock';

const electionGeneralDefinition = electionGeneral.toElectionDefinition();

test('getMockMultiLanguageElectionDefinition', () => {
  const electionDefinition = electionGeneralDefinition;
  expect(
    electionDefinition.election.ballotStyles.map((bs) => ({
      id: bs.id,
      languages: bs.languages,
    }))
  ).toEqual([{ id: '12' }, { id: '5' }]);

  const modifiedElectionDefinition = getMockMultiLanguageElectionDefinition(
    electionDefinition,
    [LanguageCode.ENGLISH, LanguageCode.SPANISH]
  );
  expect(
    modifiedElectionDefinition.election.ballotStyles.map((bs) => ({
      id: bs.id,
      languages: bs.languages,
    }))
  ).toEqual([
    { id: '1_en', languages: [LanguageCode.ENGLISH] },
    { id: '1_es-US', languages: [LanguageCode.SPANISH] },
    { id: '2_en', languages: [LanguageCode.ENGLISH] },
    { id: '2_es-US', languages: [LanguageCode.SPANISH] },
  ]);

  expect(modifiedElectionDefinition.ballotHash).not.toEqual(
    electionDefinition.ballotHash
  );
});
