import { LanguageCode } from '@vx/libs/types/src';

import {
  DEFAULT_LANGUAGE_CODE,
  useFrontendLanguageContext,
} from '../ui_strings/language_context';

export function useAvailableLanguages(): LanguageCode[] {
  return (
    useFrontendLanguageContext()?.availableLanguages || [DEFAULT_LANGUAGE_CODE]
  );
}
