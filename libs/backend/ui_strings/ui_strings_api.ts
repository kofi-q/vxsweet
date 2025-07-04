/* istanbul ignore file - tested via VxSuite apps. */

import { BaseLogger } from '@vx/libs/logging/src';
import * as grout from '@vx/libs/grout/src';
import {
  type UiStringAudioClips,
  type UiStringAudioIds,
  type UiStringTranslations,
} from '@vx/libs/types/ui_strings';
import { type UiStringsStore } from './ui_strings_store';

/** App context for {@link UiStringsApi} endpoints. */
export interface UiStringsApiContext {
  logger: BaseLogger;
  store: UiStringsStore;
}

function buildApi(context: UiStringsApiContext) {
  const { store } = context;

  return grout.createApi({
    getAvailableLanguages(): string[] {
      return store.getLanguages();
    },

    getUiStrings(input: { languageCode: string }): UiStringTranslations | null {
      return store.getUiStrings(input.languageCode);
    },

    getUiStringAudioIds(input: {
      languageCode: string;
    }): UiStringAudioIds | null {
      return store.getUiStringAudioIds(input.languageCode);
    },

    getAudioClips(input: {
      languageCode: string;
      audioIds: string[];
    }): UiStringAudioClips {
      return store.getAudioClips(input);
    },
  });
}

/** Grout API definition for UI string functions */
export type UiStringsApi = ReturnType<typeof buildApi>;

/** Creates a shareable implementation of {@link UiStringsApi}. */
export function createUiStringsApi(context: UiStringsApiContext): UiStringsApi {
  return buildApi(context);
}
