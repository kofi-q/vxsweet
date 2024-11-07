import React from 'react';

import { LanguageCode } from '@vx/libs/types/languages';

import {
  DEFAULT_LANGUAGE_CODE,
  useFrontendLanguageContext,
} from './language_context/language_context';

export interface LanguageControls {
  reset: () => void;
  setLanguage: (languageCode: LanguageCode) => void;
}

function noOp() {}

export function useLanguageControls(): LanguageControls {
  const languageContext = useFrontendLanguageContext();

  const setLanguage = languageContext?.setLanguage || noOp;

  const reset = React.useCallback(() => {
    setLanguage(DEFAULT_LANGUAGE_CODE);
  }, [setLanguage]);

  return {
    reset,
    setLanguage,
  };
}
