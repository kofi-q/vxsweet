import { sliceBallotHashForEncoding } from '@vx/libs/ballot-encoder/src';
import {
  assert,
  assertDefined,
  throwIllegalValue,
} from '@vx/libs/basics/assert';
import { find } from '@vx/libs/basics/collections';
import { ok, type Ok, type Result } from '@vx/libs/basics/result';
import { typedAs } from '@vx/libs/basics/types';
import { iter } from '@vx/libs/basics/iterators';
import { fromGrayScale } from '@vx/libs/image-utils/src';
import {
  type AdjudicationInfo,
  AdjudicationReason,
  type AnyContest,
  asSheet,
  type BallotMetadata,
  type BallotPageContestLayout,
  type BallotPageContestOptionLayout,
  type BallotStyleId,
  type BallotTargetMark,
  BallotType,
  type ContestOption,
  type Contests,
  type ElectionDefinition,
  getBallotStyle,
  getContests,
  type GridPosition,
  type HmpbBallotPageMetadata,
  mapSheet,
  type MarkInfo,
  MarkStatus,
  type SheetOf,
  type VotesDict,
  WriteInAreaStatus,
  type WriteInId,
} from '@vx/libs/types/elections';
import { type Corners, type Rect } from '@vx/libs/types/geometry';
import { type Id } from '@vx/libs/types/basic';
import {
  type InterpretedHmpbPage,
  type InvalidBallotHashPage,
  type InvalidPrecinctPage,
  type InvalidTestModePage,
  type PageInterpretation,
  type PageInterpretationWithFiles,
} from '@vx/libs/types/scanning';
import {
  ALL_PRECINCTS_SELECTION,
  convertMarksToVotesDict,
  time,
} from '@vx/libs/utils/src';
import { allContestOptions } from '@vx/libs/utils/src/hmpb';
import { ImageData } from 'canvas';
import makeDebug from 'debug';
import {
  getAllPossibleAdjudicationReasons,
  getAllPossibleAdjudicationReasonsForBmdVotes,
} from './adjudication_reasons';
import { interpret as interpretVxBmdBallotSheet } from './bmd/interpret';
import {
  type BallotConfig,
  type Geometry,
  type InterpretedBallotCard,
  type InterpretedContestLayout,
  type InterpretedContestOptionLayout,
  type HmpbInterpretResult,
  type Rect as NextRect,
  type ScoredBubbleMark,
  type ScoredBubbleMarks,
  type ScoredPositionArea,
} from './hmpb-ts/types';
import { interpret as interpretHmpbBallotSheetRust } from './hmpb-ts/interpret';
import { saveSheetImages } from './save_images';
import { type InterpreterOptions } from './types';
import { normalizeBallotMode } from './validation';

const debug = makeDebug('ballot-interpreter:scan:interpreter');

/**
 * Result of interpreting a sheet of ballot images.
 */
export type InterpretResult = Result<SheetOf<InterpretFileResult>, Error>;

/**
 * Result of interpreting a single ballot image.
 */
export interface InterpretFileResult {
  interpretation: PageInterpretation;
  normalizedImage: ImageData;
}

/**
 * Conversion intermediary for marks containing the grid position, associated
 * contest option, the mark score, and the write-in area score if applicable.
 */
interface ScoredContestOption {
  option: ContestOption;
  gridPosition: GridPosition;
  scoredMark: ScoredBubbleMark;
  markStatus: MarkStatus;
  scoredWriteInArea?: ScoredPositionArea;
  writeInAreaStatus: WriteInAreaStatus;
}

type OkType<T> = T extends Ok<infer U> ? U : never;

function getContestOptionForGridPosition(
  contests: Contests,
  gridPosition: GridPosition
): ContestOption {
  const contest = find(contests, (c) => c.id === gridPosition.contestId);
  const option = iter(allContestOptions(contest)).find((o) =>
    gridPosition.type === 'option'
      ? o.id === gridPosition.optionId
      : o.type === 'candidate' && o.writeInIndex === gridPosition.writeInIndex
  );
  assert(
    option,
    `option not found for mark ${gridPosition.contestId}/${
      gridPosition.type === 'option'
        ? gridPosition.optionId
        : `write-in-${gridPosition.writeInIndex}`
    }`
  );

  return option;
}

/**
 * Finds the scored write-in area for the given grid position. Asserts that the
 * grid position represents a write-in, should be used only if the area is expected to exist.
 */
function findScoredWriteInAreaForGridPosition(
  scoredWriteInAreas: ScoredPositionArea[],
  gridPosition: GridPosition
): ScoredPositionArea {
  assert(gridPosition.type === 'write-in');
  return find(
    scoredWriteInAreas,
    (w) =>
      w.gridPosition.type === 'write-in' &&
      w.gridPosition.contestId === gridPosition.contestId &&
      w.gridPosition.writeInIndex === gridPosition.writeInIndex
  );
}

function shouldScoreWriteIns(options: InterpreterOptions): boolean {
  return options.adjudicationReasons.includes(
    AdjudicationReason.UnmarkedWriteIn
  );
}

// TODO: Replace usage of this with write-in thresholds specific to each write-in
const TEMPORARY_DEFAULT_WRITE_IN_AREA_THRESHOLD = 0.05;

/**
 * Determining marks, adjudication status, and and unmarked write-ins share similar
 * checks and thresholds, so we aggregate information here as a conversion intermediary.
 */
function aggregateContestOptionScores({
  marks,
  writeIns,
  contests,
  options,
}: {
  marks: ScoredBubbleMarks;
  writeIns: ScoredPositionArea[];
  contests: Contests;
  options: InterpreterOptions;
}): ScoredContestOption[] {
  return marks.map(([gridPosition, scoredMark]) => {
    const option = getContestOptionForGridPosition(contests, gridPosition);

    assert(scoredMark, 'scoredMark must be defined');
    const markStatus =
      scoredMark.fillScore >= options.markThresholds.definite
        ? MarkStatus.Marked
        : scoredMark.fillScore >= options.markThresholds.marginal
        ? MarkStatus.Marginal
        : MarkStatus.Unmarked;

    const expectScoredWriteInArea =
      shouldScoreWriteIns(options) && gridPosition.type === 'write-in';
    const scoredWriteInArea = expectScoredWriteInArea
      ? findScoredWriteInAreaForGridPosition(writeIns, gridPosition)
      : undefined;
    const writeInTextAreaThreshold =
      options.markThresholds.writeInTextArea ??
      /* istanbul ignore next */
      TEMPORARY_DEFAULT_WRITE_IN_AREA_THRESHOLD;
    const writeInAreaStatus = scoredWriteInArea
      ? scoredWriteInArea.score >= writeInTextAreaThreshold
        ? WriteInAreaStatus.Filled
        : WriteInAreaStatus.Unfilled
      : WriteInAreaStatus.Ignored;

    return {
      option,
      gridPosition,
      scoredMark,
      markStatus,
      scoredWriteInArea,
      writeInAreaStatus,
    };
  });
}

function convertScoredContestOptionToLegacyMark({
  option,
  scoredMark,
}: ScoredContestOption): BallotTargetMark {
  const bounds: Rect = {
    x: scoredMark.matchedBounds.left,
    y: scoredMark.matchedBounds.top,
    width: scoredMark.matchedBounds.width,
    height: scoredMark.matchedBounds.height,
  };

  if (option.type === 'candidate' || option.type === 'yesno') {
    const ballotTargetMarkBase: Omit<BallotTargetMark, 'type' | 'optionId'> = {
      contestId: option.contestId,
      score: scoredMark.fillScore,
      bounds,
      scoredOffset: {
        x: scoredMark.matchedBounds.left - scoredMark.expectedBounds.left,
        y: scoredMark.matchedBounds.top - scoredMark.expectedBounds.top,
      },
      target: {
        inner: bounds,
        bounds,
      },
    };

    return { type: option.type, optionId: option.id, ...ballotTargetMarkBase };
  }

  /* istanbul ignore next */
  throwIllegalValue(option);
}

function convertScoredContestOptionsToMarkInfo(
  geometry: Geometry,
  scoredContestOptions: ScoredContestOption[]
): MarkInfo {
  const markInfo: MarkInfo = {
    ballotSize: geometry.canvasSize,
    marks: scoredContestOptions.map((scoredContestOption) =>
      convertScoredContestOptionToLegacyMark(scoredContestOption)
    ),
  };

  return markInfo;
}

function getUnmarkedWriteInsFromScoredContestOptions(
  scoredContestOptions: ScoredContestOption[]
): InterpretedHmpbPage['unmarkedWriteIns'] {
  return scoredContestOptions
    .filter(
      ({ markStatus, writeInAreaStatus }) =>
        markStatus !== MarkStatus.Marked &&
        writeInAreaStatus === WriteInAreaStatus.Filled
    )
    .map(({ option, scoredWriteInArea }) => {
      assert(scoredWriteInArea);
      return {
        contestId: option.contestId,
        optionId: option.id as WriteInId,
      };
    });
}

/**
 * Derives adjudication information from contests.
 */
export function determineAdjudicationInfoFromBmdVotes(
  electionDefinition: ElectionDefinition,
  options: InterpreterOptions,
  votes: VotesDict,
  ballotStyleId: BallotStyleId
): AdjudicationInfo {
  const bmdAdjudicationReasons = [
    AdjudicationReason.BlankBallot,
    AdjudicationReason.Undervote,
  ];
  const enabledReasons = options.adjudicationReasons.filter((reason) =>
    bmdAdjudicationReasons.includes(reason)
  );
  const { election } = electionDefinition;

  const adjudicationReasonInfos = getAllPossibleAdjudicationReasonsForBmdVotes(
    getContests({
      ballotStyle: assertDefined(getBallotStyle({ ballotStyleId, election })),
      election,
    }),
    votes
  );

  const [enabledReasonInfos, ignoredReasonInfos] = iter(
    adjudicationReasonInfos
  ).partition((reasonInfo) => enabledReasons.includes(reasonInfo.type));

  return {
    requiresAdjudication: enabledReasonInfos.length > 0,
    enabledReasonInfos: [...enabledReasonInfos],
    enabledReasons,
    ignoredReasonInfos: [...ignoredReasonInfos],
  };
}

/**
 * Derives adjudication information from the given marks.
 */
export function determineAdjudicationInfoFromScoredContestOptions(
  electionDefinition: ElectionDefinition,
  options: InterpreterOptions,
  contestOptionScores: ScoredContestOption[]
): AdjudicationInfo {
  const enabledReasons = options.adjudicationReasons;

  const contests = electionDefinition.election.contests.filter((c) =>
    contestOptionScores.some(
      ({ gridPosition: { contestId } }) => contestId === c.id
    )
  );
  const adjudicationReasonInfos = getAllPossibleAdjudicationReasons(
    contests,
    contestOptionScores
  );

  const [enabledReasonInfos, ignoredReasonInfos] = iter(
    adjudicationReasonInfos
  ).partition((reasonInfo) => enabledReasons.includes(reasonInfo.type));

  return {
    requiresAdjudication: enabledReasonInfos.length > 0,
    enabledReasonInfos: [...enabledReasonInfos],
    enabledReasons,
    ignoredReasonInfos: [...ignoredReasonInfos],
  };
}

function buildInterpretedHmpbPageMetadata(
  electionDefinition: ElectionDefinition,
  options: InterpreterOptions,
  ballotConfig: BallotConfig,
  side: 'front' | 'back'
): HmpbBallotPageMetadata {
  const { election } = electionDefinition;
  const ballotStyle = getBallotStyle({
    election,
    ballotStyleId: `card-number-${ballotConfig.card}` as BallotStyleId,
  });
  assert(ballotStyle, `Ballot style ${ballotConfig.card} not found`);
  const precinctId = ballotStyle.precincts[0];
  assert(
    precinctId !== undefined,
    `Precinct ${ballotConfig.batchOrPrecinct} not found`
  );

  return {
    ballotStyleId: ballotStyle.id,
    precinctId,
    ballotType: BallotType.Precinct,
    ballotHash: electionDefinition.ballotHash,
    isTestMode: options.testMode,
    pageNumber: side === 'front' ? 1 : 2,
  };
}

function convertContestLayouts(
  contests: Contests,
  contestLayouts: InterpretedContestLayout[]
): BallotPageContestLayout[] {
  function convertRect(rect: NextRect): Rect {
    return {
      x: rect.left,
      y: rect.top,
      width: rect.width,
      height: rect.height,
    };
  }

  function rectToCorners(rect: NextRect): Corners {
    return [
      // Top left
      { x: rect.left, y: rect.top },
      // Top right
      { x: rect.left + rect.width, y: rect.top },
      // Bottom left
      { x: rect.left, y: rect.top + rect.height },
      // Bottom right
      { x: rect.left + rect.width, y: rect.top + rect.height },
    ];
  }

  function convertContestOptionLayout(
    contest: AnyContest,
    { bounds, optionId }: InterpretedContestOptionLayout
  ): BallotPageContestOptionLayout {
    const option = iter(allContestOptions(contest)).find(
      (o) => o.id === optionId
    );
    assert(option, `option ${optionId} not found`);
    return {
      definition: option,
      bounds: convertRect(bounds),
      // TODO is this needed? Filled with a dummy value for now
      target: {
        bounds: { x: 0, y: 0, width: 1, height: 1 },
        inner: { x: 0, y: 0, width: 1, height: 1 },
      },
    };
  }

  return contestLayouts.map(({ contestId, bounds, options }) => {
    const contest = find(contests, (c) => c.id === contestId);
    return {
      contestId,
      bounds: convertRect(bounds),
      corners: rectToCorners(bounds),
      options: options.map((option) =>
        convertContestOptionLayout(contest, option)
      ),
    };
  });
}

function convertInterpretedBallotPage(
  electionDefinition: ElectionDefinition,
  options: InterpreterOptions,
  interpretedBallotCard: InterpretedBallotCard,
  side: 'front' | 'back'
): InterpretFileResult {
  const sideMetadata = interpretedBallotCard[side].metadata;
  const metadata =
    sideMetadata.source === 'qr-code'
      ? sideMetadata
      : buildInterpretedHmpbPageMetadata(
          electionDefinition,
          options,
          // For timing mark metadata, always use the front, since it contains
          // the info we need
          interpretedBallotCard.front.metadata as BallotConfig,
          side
        );

  const interpretation = interpretedBallotCard[side];
  const contestOptionScores: ScoredContestOption[] =
    aggregateContestOptionScores({
      marks: interpretation.marks,
      writeIns: interpretation.writeIns,
      contests: electionDefinition.election.contests,
      options,
    });
  const markInfo = convertScoredContestOptionsToMarkInfo(
    interpretation.grid.geometry,
    contestOptionScores
  );
  return {
    interpretation: {
      type: 'InterpretedHmpbPage',
      metadata,
      markInfo,
      adjudicationInfo: determineAdjudicationInfoFromScoredContestOptions(
        electionDefinition,
        options,
        contestOptionScores
      ),
      votes: convertMarksToVotesDict(
        electionDefinition.election.contests,
        options.markThresholds,
        markInfo.marks
      ),
      unmarkedWriteIns: shouldScoreWriteIns(options)
        ? getUnmarkedWriteInsFromScoredContestOptions(contestOptionScores)
        : undefined,
      layout: {
        pageSize: interpretation.grid.geometry.canvasSize,
        metadata,
        contests: convertContestLayouts(
          electionDefinition.election.contests,
          interpretation.contestLayouts
        ),
      },
    },
    normalizedImage: interpretation.normalizedImage,
  };
}

/**
 * Converts the result of the Rust interpreter to the result format used by the
 * rest of VxSuite.
 */
export function convertRustInterpretResult(
  options: InterpreterOptions,
  result: HmpbInterpretResult,
  sheet: SheetOf<ImageData>
): InterpretResult {
  /* istanbul ignore next */
  if (result.isErr()) {
    return ok(
      mapSheet(
        sheet,
        (imageData) =>
          ({
            interpretation: {
              type: 'UnreadablePage',
              reason: result.err().type,
            },
            normalizedImage: imageData,
          }) as const
      )
    );
  }

  const ballotCard = result.ok();
  const currentResult: OkType<InterpretResult> = [
    convertInterpretedBallotPage(
      options.electionDefinition,
      options,
      ballotCard,
      'front'
    ),
    convertInterpretedBallotPage(
      options.electionDefinition,
      options,
      ballotCard,
      'back'
    ),
  ];
  return ok(currentResult);
}

/**
 * Validates the interpreter results against the scanning configuration.
 *
 * @returns The same results, but with any invalid results replaced with an
 *          error result.
 */
function validateInterpretResults(
  results: SheetOf<InterpretFileResult>,
  options: InterpreterOptions
): SheetOf<InterpretFileResult> {
  const {
    electionDefinition: { ballotHash },
    precinctSelection,
    testMode,
  } = options;

  return mapSheet(results, (result) => {
    const { normalizedImage } = result;
    const interpretation = normalizeBallotMode(result.interpretation, options);

    if (!('metadata' in interpretation)) {
      return { interpretation, normalizedImage };
    }

    const metadata = interpretation.metadata as BallotMetadata;

    if (metadata.isTestMode !== testMode) {
      return {
        interpretation: typedAs<InvalidTestModePage>({
          type: 'InvalidTestModePage',
          metadata,
        }),
        normalizedImage,
      };
    }

    if (
      precinctSelection.kind !== ALL_PRECINCTS_SELECTION.kind &&
      metadata.precinctId !== precinctSelection.precinctId
    ) {
      return {
        interpretation: typedAs<InvalidPrecinctPage>({
          type: 'InvalidPrecinctPage',
          metadata,
        }),
        normalizedImage,
      };
    }

    // metadata.ballotHash may be a sliced hash or a full hash, so we need to
    // slice both hashes before comparing them.
    if (
      sliceBallotHashForEncoding(metadata.ballotHash) !==
      sliceBallotHashForEncoding(ballotHash)
    ) {
      return {
        interpretation: typedAs<InvalidBallotHashPage>({
          type: 'InvalidBallotHashPage',
          expectedBallotHash: sliceBallotHashForEncoding(ballotHash),
          actualBallotHash: sliceBallotHashForEncoding(metadata.ballotHash),
        }),
        normalizedImage,
      };
    }

    return { interpretation, normalizedImage };
  });
}

/**
 * Interpret a HMPB sheet and convert the result from the Rust
 * interpreter's result format to the result format used by the rest of VxSuite.
 */
function interpretHmpb(
  sheet: SheetOf<ImageData>,
  options: InterpreterOptions
): SheetOf<InterpretFileResult> {
  const { electionDefinition } = options;
  const result = interpretHmpbBallotSheetRust(electionDefinition, sheet, {
    scoreWriteIns: shouldScoreWriteIns(options),
  });

  return validateInterpretResults(
    convertRustInterpretResult(options, result, sheet).unsafeUnwrap(),
    options
  );
}

/**
 * Interpret a ballot sheet and convert the result into
 * the result format used by the rest of VxSuite.
 */
async function interpretBmdBallot(
  ballotImages: SheetOf<ImageData>,
  options: InterpreterOptions
): Promise<SheetOf<InterpretFileResult>> {
  const { electionDefinition } = options;
  const interpretResult = await interpretVxBmdBallotSheet(
    electionDefinition,
    ballotImages
  );

  if (interpretResult.isErr()) {
    const error = interpretResult.err();
    if (error.type === 'mismatched-election') {
      return [
        {
          interpretation: {
            type: 'InvalidBallotHashPage',
            expectedBallotHash: error.expectedBallotHash,
            actualBallotHash: error.actualBallotHash,
          },
          normalizedImage: ballotImages[0],
        },
        {
          interpretation: {
            type: 'InvalidBallotHashPage',
            expectedBallotHash: error.expectedBallotHash,
            actualBallotHash: error.actualBallotHash,
          },
          normalizedImage: ballotImages[1],
        },
      ];
    }

    const [frontReason, backReason] = error.source;
    switch (error.type) {
      case 'votes-not-found':
        return [
          {
            interpretation: {
              type: 'BlankPage',
            },
            normalizedImage: ballotImages[0],
          },
          {
            interpretation: {
              type: 'BlankPage',
            },
            normalizedImage: ballotImages[1],
          },
        ];

      case 'multiple-qr-codes':
        return [
          {
            interpretation: {
              type: 'UnreadablePage',
              reason: JSON.stringify(frontReason),
            },
            normalizedImage: ballotImages[0],
          },
          {
            interpretation: {
              type: 'UnreadablePage',
              reason: JSON.stringify(backReason),
            },
            normalizedImage: ballotImages[1],
          },
        ];

      /* istanbul ignore next - compile-time check */
      default:
        throwIllegalValue(error, 'type');
    }
  }

  const { ballot, summaryBallotImage, blankPageImage } = interpretResult.ok();
  const adjudicationInfo = determineAdjudicationInfoFromBmdVotes(
    electionDefinition,
    options,
    ballot.votes,
    ballot.ballotStyleId
  );

  const front: InterpretFileResult = {
    interpretation: {
      type: 'InterpretedBmdPage',
      ballotId: ballot.ballotId,
      metadata: {
        ballotHash: ballot.ballotHash,
        ballotType: BallotType.Precinct,
        ballotStyleId: ballot.ballotStyleId,
        precinctId: ballot.precinctId,
        isTestMode: ballot.isTestMode,
      },
      votes: ballot.votes,
      adjudicationInfo,
    },
    normalizedImage: summaryBallotImage,
  };
  const back: InterpretFileResult = {
    interpretation: {
      type: 'BlankPage',
    },
    normalizedImage: blankPageImage,
  };

  return validateInterpretResults([front, back], options);
}

/**
 * Interpret a single-sided BMD ballot sheet and convert the result into
 * the result format used by the rest of VxSuite.
 */
export async function interpretSimplexBmdBallot(
  frontImage: ImageData,
  options: InterpreterOptions
): Promise<SheetOf<InterpretFileResult>> {
  const ballotImages: SheetOf<ImageData> = [
    frontImage,
    fromGrayScale(new Uint8ClampedArray([0]), 1, 1),
  ];
  return interpretBmdBallot(ballotImages, options);
}

/**
 * Scores an interpretation result to determine which interpretation is more
 * relevant. The higher the score, the more relevant the interpretation is. In
 * general, a more relevant interpretation is one which contains more specific
 * information.
 */
function scoreInterpretFileResult(
  result: SheetOf<InterpretFileResult>
): number {
  const [frontType, backType] = mapSheet(result, (r) => r.interpretation.type);

  if (
    (frontType === 'InterpretedBmdPage' && backType === 'BlankPage') ||
    (frontType === 'BlankPage' && backType === 'InterpretedBmdPage')
  ) {
    return 0;
  }

  if (
    frontType === 'InterpretedHmpbPage' &&
    backType === 'InterpretedHmpbPage'
  ) {
    return 0;
  }

  if (frontType === 'BlankPage' && backType === 'BlankPage') {
    return -100;
  }

  if (frontType === 'UnreadablePage' || backType === 'UnreadablePage') {
    return -90;
  }

  if (
    frontType === 'InvalidPrecinctPage' ||
    backType === 'InvalidPrecinctPage'
  ) {
    return -80;
  }

  if (
    frontType === 'InvalidTestModePage' ||
    backType === 'InvalidTestModePage'
  ) {
    return -70;
  }

  if (
    frontType === 'InvalidBallotHashPage' ||
    backType === 'InvalidBallotHashPage'
  ) {
    return -60;
  }

  /* istanbul ignore next - should be unreachable */
  throw new Error(`Unexpected result types: ${frontType}, ${backType}`);
}

/**
 * Chooses which interpretation to use based on which one is more relevant.
 */
function chooseInterpretationToUse(
  bmdInterpretation: SheetOf<InterpretFileResult>,
  hmpbInterpretation?: SheetOf<InterpretFileResult>
): SheetOf<InterpretFileResult> {
  if (!hmpbInterpretation) {
    return bmdInterpretation;
  }

  return scoreInterpretFileResult(bmdInterpretation) >
    scoreInterpretFileResult(hmpbInterpretation)
    ? bmdInterpretation
    : hmpbInterpretation;
}

/**
 * Interpret a sheet of ballot images.
 */
export async function interpretSheet(
  options: InterpreterOptions,
  sheet: SheetOf<ImageData>
): Promise<SheetOf<InterpretFileResult>> {
  const timer = time(debug, 'interpretSheet');

  try {
    const hmpbInterpretation = options.electionDefinition.election.gridLayouts
      ? interpretHmpb(sheet, options)
      : undefined;

    if (
      hmpbInterpretation?.[0].interpretation.type === 'InterpretedHmpbPage' &&
      hmpbInterpretation[1].interpretation.type === 'InterpretedHmpbPage'
    ) {
      return hmpbInterpretation;
    }

    const bmdInterpretation = await interpretBmdBallot(sheet, options);

    return chooseInterpretationToUse(bmdInterpretation, hmpbInterpretation);
  } finally {
    timer.end();
  }
}

/**
 * Interpret a ballot sheet and save the images to their final storage location.
 */
export async function interpretSheetAndSaveImages(
  interpreterOptions: InterpreterOptions,
  sheet: SheetOf<ImageData>,
  sheetId: Id,
  ballotImagesPath: string
): Promise<SheetOf<PageInterpretationWithFiles>> {
  const timer = time(debug, `interpretSheetAndSaveImages`);
  try {
    const interpreted = await interpretSheet(interpreterOptions, sheet);
    timer.checkpoint('interpretSheet');
    const imagePaths = await saveSheetImages({
      sheetId,
      ballotImagesPath,
      images: mapSheet(interpreted, ({ normalizedImage }) => normalizedImage),
    });

    return asSheet(
      iter(interpreted)
        .zip(imagePaths)
        .map(([{ interpretation }, imagePath]) => {
          return {
            interpretation,
            imagePath,
          };
        })
        .toArray()
    );
  } finally {
    timer.checkpoint('save images');
    timer.end();
  }
}
