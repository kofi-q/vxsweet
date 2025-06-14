import {
  type Election,
  type ElectionDefinition,
} from '@vx/libs/types/elections';
import { LanguageCode } from '@vx/libs/types/languages';
import { safeParseElectionDefinition } from '@vx/libs/types/election-parsing';
import { generateBallotStyleId } from './ballot_styles';

export function getMockMultiLanguageElectionDefinition(
  electionDefinition: ElectionDefinition,
  languages: LanguageCode[]
): ElectionDefinition {
  const { election } = electionDefinition;
  const modifiedElection: Election = {
    ...election,
    ballotStyles: election.ballotStyles.flatMap((ballotStyle, i) =>
      languages.map((languageCode) => ({
        ...ballotStyle,
        id: generateBallotStyleId({
          ballotStyleIndex: i + 1,
          languages: [languageCode],
        }),
        languages: [languageCode],
      }))
    ),
  };
  return safeParseElectionDefinition(
    JSON.stringify(modifiedElection)
  ).unsafeUnwrap();
}
