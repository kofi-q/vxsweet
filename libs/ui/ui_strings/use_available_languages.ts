import {
  DEFAULT_LANGUAGE_CODE,
  useFrontendLanguageContext,
} from './language_context/language_context';

export function useAvailableLanguages(): string[] {
  return (
    useFrontendLanguageContext()?.availableLanguages || [DEFAULT_LANGUAGE_CODE]
  );
}
