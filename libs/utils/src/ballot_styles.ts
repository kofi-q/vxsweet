import { type Result, err, ok } from '@vx/libs/basics/result';
import { assertDefined } from '@vx/libs/basics/assert';
import { deepEqual } from '@vx/libs/basics/objects';
import { iter } from '@vx/libs/basics/iterators';
import {
  type BallotStyle,
  type BallotStyleGroupId,
  type BallotStyleId,
  type BallotStyleGroup,
  type Party,
  type Election,
} from '@vx/libs/types/elections';
import { LanguageCode } from '@vx/libs/types/languages';

const ID_LANGUAGES_SEPARATOR = '_';
const GROUP_ID_PARTS_SEPARATOR = '-';

export function generateBallotStyleGroupId(params: {
  ballotStyleIndex: number;
  party?: Party;
}): BallotStyleGroupId {
  return params.party
    ? (`${params.ballotStyleIndex}${GROUP_ID_PARTS_SEPARATOR}${params.party.abbrev}` as BallotStyleGroupId)
    : (params.ballotStyleIndex.toString() as BallotStyleGroupId);
}

/**
 * Generates a ballot style ID based on the given parameters in the format:
 * `<index>[_<partyAbbreviation>]_<languageCode1>[_<languageCode2>...]`
 */
export function generateBallotStyleId(params: {
  ballotStyleIndex: number;
  languages: LanguageCode[];
  party?: Party;
}): BallotStyleId {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
  return [generateBallotStyleGroupId(params), ...params.languages].join(
    ID_LANGUAGES_SEPARATOR
  ) as BallotStyleId;
}

function getBallotStyleGroupMap(
  ballotStyles: readonly BallotStyle[]
): Map<BallotStyleGroupId, Set<BallotStyle>> {
  return iter(ballotStyles).toMap((b) => b.groupId);
}

/**
 * Returns a language-specific ballot style, for the given
 * {@link targetBallotStyleLanguage}, that belongs to the same
 * language-agnostic ballot style group as the given
 * {@link sourceBallotStyleId}.
 */
export function getRelatedBallotStyle(params: {
  ballotStyles: readonly BallotStyle[];
  sourceBallotStyleId: BallotStyleId;
  targetBallotStyleLanguage: string;
}): Result<BallotStyle, string> {
  const { ballotStyles, sourceBallotStyleId, targetBallotStyleLanguage } =
    params;

  const sourceBallotStyle = ballotStyles.find(
    (b) => b.id === sourceBallotStyleId
  );
  if (!sourceBallotStyle) {
    return err(`ballot style not found: ${sourceBallotStyleId}`);
  }

  // For legacy language-agnostic ballot styles, return the same ballot style:
  if (iter(sourceBallotStyle.languages).isEmpty()) {
    return ok(sourceBallotStyle);
  }

  const ballotStyleGroups = getBallotStyleGroupMap(ballotStyles);
  const matchingGroup = assertDefined(
    ballotStyleGroups.get(sourceBallotStyle.groupId)
  );

  const destinationBallotStyle = iter(matchingGroup).find((b) =>
    deepEqual(b.languages, [targetBallotStyleLanguage])
  );
  if (!destinationBallotStyle) {
    return err('destination ballot style not found');
  }

  return ok(destinationBallotStyle);
}

/**
 * Returns ballot style group details from the given total set of ballot styles
 *
 * The returned list will include all legacy language-agnostic ballot styles as their own
 * group as well, if included in the original list.
 *
 */

export function getGroupedBallotStyles(
  ballotStyles: readonly BallotStyle[]
): BallotStyleGroup[] {
  const ballotStylesByGroupId = getBallotStyleGroupMap(ballotStyles);
  return iter(ballotStylesByGroupId.keys())
    .map((groupId) => {
      const ballotStyleGroup = assertDefined(
        ballotStylesByGroupId.get(groupId)
      );
      let englishBallotStyle: BallotStyle | undefined;
      let legacyBallotStyle: BallotStyle | undefined;

      for (const ballotStyle of ballotStyleGroup) {
        if (deepEqual(ballotStyle.languages, [LanguageCode.ENGLISH])) {
          englishBallotStyle = ballotStyle;
        } else if (!ballotStyle.languages) {
          legacyBallotStyle = ballotStyle;
        }
      }

      const defaultLanguageBallotStyle = assertDefined(
        englishBallotStyle || legacyBallotStyle,
        'Expected at least one English language ballot style per ballot style group.'
      );
      return {
        ...defaultLanguageBallotStyle,
        id: groupId,
        ballotStyles: Array.from(ballotStyleGroup),
        defaultLanguageBallotStyle,
      };
    })
    .toArray();
}

/**
 * Finds a {@link BallotStyleGroup} by the given ID.
 */
export function getBallotStyleGroup({
  election,
  ballotStyleGroupId,
}: {
  election: Election;
  ballotStyleGroupId: BallotStyleGroupId;
}): BallotStyleGroup | undefined {
  return getGroupedBallotStyles(election.ballotStyles).find(
    (group) => group.id === ballotStyleGroupId
  );
}
