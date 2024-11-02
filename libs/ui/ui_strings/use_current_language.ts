import { LanguageCode } from '@vx/libs/types/src';
import {
  DEFAULT_LANGUAGE_CODE,
  useLanguageContext,
} from './language_context/language_context';

export function useCurrentLanguage(): LanguageCode {
  return useLanguageContext()?.currentLanguageCode || DEFAULT_LANGUAGE_CODE;
}
