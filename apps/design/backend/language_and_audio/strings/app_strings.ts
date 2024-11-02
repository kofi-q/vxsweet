import fs from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import {
  LanguageCode,
  safeParseJson,
  type MachineVersion,
  type UiStringsPackage,
} from '@vx/libs/types/src';

import { GoogleCloudTranslator } from '../translation/translator';
import { setUiString } from '../utils/utils';
import {
  type BallotLanguageConfigs,
  getAllBallotLanguages,
} from '../../types/types';

export async function translateAppStrings(
  translator: GoogleCloudTranslator,
  machineVersion: MachineVersion,
  ballotLanguageConfigs: BallotLanguageConfigs
): Promise<UiStringsPackage> {
  const languages = getAllBallotLanguages(ballotLanguageConfigs);

  const appStringsCatalogFileContents = await fs.readFile(
    path.join(
      __dirname,
      `../../../../../libs/ui/src/ui_strings/app_strings_catalog/${machineVersion}.json`
    ),
    'utf-8'
  );
  const appStringsCatalog = safeParseJson(
    appStringsCatalogFileContents,
    z.record(z.string())
  ).unsafeUnwrap();

  const appStringKeys = Object.keys(appStringsCatalog).sort();
  const appStringsInEnglish = appStringKeys.map<string>(
    (key) => appStringsCatalog[key]
  );

  const appStrings: UiStringsPackage = {};
  for (const languageCode of languages) {
    const appStringsInLanguage =
      languageCode === LanguageCode.ENGLISH
        ? appStringsInEnglish
        : await translator.translateText(appStringsInEnglish, languageCode);
    for (const [i, key] of appStringKeys.entries()) {
      setUiString(appStrings, languageCode, key, appStringsInLanguage[i]);
    }
  }

  return appStrings;
}
