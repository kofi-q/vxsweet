import { InterpretFileResult } from '@vx/libs/ballot-interpreter/src';
import { BLANK_PAGE_IMAGE_DATA } from '@vx/libs/image-utils/src';
import { SheetOf } from '@vx/libs/types/src';

export const BLANK_PAGE_MOCK: InterpretFileResult = {
  interpretation: { type: 'BlankPage' },
  normalizedImage: BLANK_PAGE_IMAGE_DATA,
};

export const BLANK_PAGE_INTERPRETATION_MOCK: SheetOf<InterpretFileResult> = [
  BLANK_PAGE_MOCK,
  BLANK_PAGE_MOCK,
];
