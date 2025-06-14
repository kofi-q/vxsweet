import {
  type BallotStyle,
  type BallotStyleGroupId,
  type BallotStyleId,
  type DistrictId,
  type Election,
  type Party,
  type PartyId,
} from '@vx/libs/types/elections';
import { LanguageCode } from '@vx/libs/types/languages';
import { election as electionGeneral } from '@vx/libs/fixtures/src/data/electionGeneral/election.json';
import {
  generateBallotStyleId,
  getBallotStyleGroup,
  getGroupedBallotStyles,
  getRelatedBallotStyle,
} from './ballot_styles';

const GREEN_PARTY: Party = {
  abbrev: 'G',
  fullName: 'The Great Green Party',
  id: 'green-party' as PartyId,
  name: 'Green Party',
};

describe('generateBallotStyleId', () => {
  test('with party ID', () => {
    expect(
      generateBallotStyleId({
        ballotStyleIndex: 3,
        languages: ['en', 'es-US'] as LanguageCode[],
        party: GREEN_PARTY,
      })
    ).toEqual(`3-G_en_es-US`);
  });

  test('without party ID', () => {
    expect(
      generateBallotStyleId({
        ballotStyleIndex: 3,
        languages: ['zh-Hans'] as LanguageCode[],
      })
    ).toEqual('3_zh-Hans');
  });
});

describe('ballot style groups', () => {
  function makeBallotStyle(
    params: Pick<BallotStyle, 'id' | 'groupId' | 'languages' | 'partyId'>
  ): BallotStyle {
    return {
      ...params,
      districts: ['district1' as DistrictId],
      precincts: ['precinct1'],
    };
  }

  const style1English = makeBallotStyle({
    id: '1_en' as BallotStyleId,
    groupId: '1' as BallotStyleGroupId,
    languages: [LanguageCode.ENGLISH],
  });

  const style1Spanish = makeBallotStyle({
    id: '1_es-US' as BallotStyleId,
    groupId: '1' as BallotStyleGroupId,
    languages: [LanguageCode.SPANISH],
  });

  const style2GreenEnglish = makeBallotStyle({
    id: '2-G_en' as BallotStyleId,
    languages: [LanguageCode.ENGLISH],
    groupId: '2-G' as BallotStyleGroupId,
    partyId: 'green-party' as PartyId,
  });

  const style2GreenEnglishMultiLanguage = makeBallotStyle({
    id: '2-G_en_es-US' as BallotStyleId,
    groupId: '2-G' as BallotStyleGroupId,
    languages: [LanguageCode.ENGLISH, LanguageCode.SPANISH],
    partyId: 'green-party' as PartyId,
  });

  const style2GreenNonEnglishSingleLanguage = makeBallotStyle({
    id: '2-G_zh-Hans' as BallotStyleId,
    groupId: '2-G' as BallotStyleGroupId,
    languages: [LanguageCode.CHINESE_SIMPLIFIED],
    partyId: 'green-party' as PartyId,
  });

  const style2PurpleEnglish = makeBallotStyle({
    id: '2-P_en' as BallotStyleId,
    groupId: '2-P' as BallotStyleGroupId,
    languages: [LanguageCode.ENGLISH],
    partyId: 'purple-party' as PartyId,
  });

  const style3LegacySchema = makeBallotStyle({
    id: 'ballot-style-3' as BallotStyleId,
    groupId: 'ballot-style-3' as BallotStyleGroupId,
  });

  test('getGroupedBallotStyles', () => {
    expect(
      getGroupedBallotStyles([
        style1English,
        style1Spanish,
        style2GreenEnglish,
        style2GreenEnglishMultiLanguage,
        style2GreenNonEnglishSingleLanguage,
        style2PurpleEnglish,
        style3LegacySchema,
      ])
    ).toEqual([
      {
        ...style1English,
        id: '1' as BallotStyleGroupId,
        ballotStyles: [style1English, style1Spanish],
        defaultLanguageBallotStyle: style1English,
      },
      {
        ballotStyles: [
          style2GreenEnglish,
          style2GreenEnglishMultiLanguage,
          style2GreenNonEnglishSingleLanguage,
        ],
        ...style2GreenEnglish,
        id: '2-G' as BallotStyleGroupId,
        defaultLanguageBallotStyle: style2GreenEnglish,
      },
      {
        ballotStyles: [style2PurpleEnglish],
        ...style2PurpleEnglish,
        id: '2-P',
        defaultLanguageBallotStyle: style2PurpleEnglish,
      },
      {
        ballotStyles: [style3LegacySchema],
        ...style3LegacySchema,
        id: 'ballot-style-3',
        defaultLanguageBallotStyle: style3LegacySchema,
      },
    ]);
  });

  test('getBallotStyleGroup', () => {
    const election: Election = {
      ...electionGeneral,
      ballotStyles: [
        style1English,
        style1Spanish,
        style2GreenEnglish,
        style2GreenEnglishMultiLanguage,
        style2GreenNonEnglishSingleLanguage,
        style2PurpleEnglish,
        style3LegacySchema,
      ],
    };
    expect(
      getBallotStyleGroup({
        election,
        ballotStyleGroupId: '1' as BallotStyleGroupId,
      })
    ).toEqual({
      ...style1English,
      id: '1' as BallotStyleGroupId,
      ballotStyles: [style1English, style1Spanish],
      defaultLanguageBallotStyle: style1English,
    });
    expect(
      getBallotStyleGroup({
        election,
        ballotStyleGroupId: '2-G' as BallotStyleGroupId,
      })
    ).toEqual({
      ballotStyles: [
        style2GreenEnglish,
        style2GreenEnglishMultiLanguage,
        style2GreenNonEnglishSingleLanguage,
      ],
      ...style2GreenEnglish,
      id: '2-G' as BallotStyleGroupId,
      defaultLanguageBallotStyle: style2GreenEnglish,
    });
    expect(
      getBallotStyleGroup({
        election,
        ballotStyleGroupId: '2-P' as BallotStyleGroupId,
      })
    ).toEqual({
      ...style2PurpleEnglish,
      ballotStyles: [style2PurpleEnglish],
      id: '2-P',
      defaultLanguageBallotStyle: style2PurpleEnglish,
    });
    expect(
      getBallotStyleGroup({
        election,
        ballotStyleGroupId: 'ballot-style-3' as BallotStyleGroupId,
      })
    ).toEqual({
      ...style3LegacySchema,
      ballotStyles: [style3LegacySchema],
      id: 'ballot-style-3',
      defaultLanguageBallotStyle: style3LegacySchema,
    });

    expect(
      getBallotStyleGroup({
        election,
        ballotStyleGroupId: style1English.id as unknown as BallotStyleGroupId,
      })
    ).toBeUndefined();
  });

  test('getRelatedBallotStyle', () => {
    const ballotStyles = [
      style1English,
      style1Spanish,
      style2GreenEnglish,
      style2GreenEnglishMultiLanguage,
      style2GreenNonEnglishSingleLanguage,
      style2PurpleEnglish,
      style3LegacySchema,
    ];

    expect(
      getRelatedBallotStyle({
        ballotStyles,
        sourceBallotStyleId: style1Spanish.id,
        targetBallotStyleLanguage: LanguageCode.ENGLISH,
      }).unsafeUnwrap()
    ).toEqual(style1English);

    expect(
      getRelatedBallotStyle({
        ballotStyles,
        sourceBallotStyleId: style1English.id,
        targetBallotStyleLanguage: LanguageCode.SPANISH,
      }).unsafeUnwrap()
    ).toEqual(style1Spanish);
  });

  test('getRelatedBallotStyle handles legacy styles', () => {
    expect(
      getRelatedBallotStyle({
        ballotStyles: [style1English, style1Spanish, style3LegacySchema],
        sourceBallotStyleId: style3LegacySchema.id,
        targetBallotStyleLanguage: LanguageCode.SPANISH,
      }).unsafeUnwrap()
    ).toEqual(style3LegacySchema);
  });

  test('getRelatedBallotStyle source style not found', () => {
    expect(
      getRelatedBallotStyle({
        ballotStyles: [style1English],
        sourceBallotStyleId: style2PurpleEnglish.id,
        targetBallotStyleLanguage: LanguageCode.ENGLISH,
      }).err()
    ).toMatch('not found');
  });

  test('getRelatedBallotStyle target style not found', () => {
    expect(
      getRelatedBallotStyle({
        ballotStyles: [style1English],
        sourceBallotStyleId: style1English.id,
        targetBallotStyleLanguage: LanguageCode.SPANISH,
      }).err()
    ).toMatch('not found');
  });
});
