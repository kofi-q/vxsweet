import {
  type BallotPageLayout,
  BallotPageLayoutSchema,
  type Contest,
} from '@vx/libs/types/elections';
import {
  type BallotSheetInfo,
  BallotSheetInfoSchema,
} from '@vx/libs/types/scanning';
import { IdSchema } from '@vx/libs/types/basic';
import * as z from 'zod';

/**
 * @url /scan/hmpb/review/next-sheet
 * @method GET
 */
export interface GetNextReviewSheetResponse {
  interpreted: BallotSheetInfo;
  layouts: {
    front?: BallotPageLayout;
    back?: BallotPageLayout;
  };
  definitions: {
    front?: {
      contestIds: ReadonlyArray<Contest['id']>;
    };
    back?: {
      contestIds: ReadonlyArray<Contest['id']>;
    };
  };
}

/**
 * @url /scan/hmpb/review/next-sheet
 * @method GET
 */
export const GetNextReviewSheetResponseSchema: z.ZodSchema<GetNextReviewSheetResponse> =
  z.object({
    interpreted: BallotSheetInfoSchema,
    layouts: z.object({
      front: BallotPageLayoutSchema.optional(),
      back: BallotPageLayoutSchema.optional(),
    }),
    definitions: z.object({
      front: z.object({ contestIds: z.array(IdSchema) }).optional(),
      back: z.object({ contestIds: z.array(IdSchema) }).optional(),
    }),
  });
