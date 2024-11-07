import { LanguageCode } from '@vx/libs/types/languages';

import {
  DEFAULT_LANGUAGE_CODE,
  useFrontendLanguageContext,
} from './language_context/language_context';

export function useAvailableLanguages(): LanguageCode[] {
  return (
    useFrontendLanguageContext()?.availableLanguages || [DEFAULT_LANGUAGE_CODE]
  );
}
