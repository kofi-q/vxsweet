import {
  DEFAULT_LANGUAGE_CODE,
  useLanguageContext,
} from './language_context/language_context';

export function useCurrentLanguage(): string {
  return useLanguageContext()?.currentLanguageCode || DEFAULT_LANGUAGE_CODE;
}
