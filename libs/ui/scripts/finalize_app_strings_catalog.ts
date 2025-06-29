import fs from 'node:fs';

import {
  type UiStringTranslations,
  UiStringTranslationsSchema,
} from '@vx/libs/types/ui_strings';
import { safeParseJson } from '@vx/libs/types/basic';
import path from 'node:path';
import { generateNumberStringsCatalog } from '../ui_strings/number_strings';

const APP_STRINGS_CATALOG_FILE_PATH = path.join(
  __dirname,
  '../ui_strings/app_strings_catalog/latest.json'
);

function addNumberStrings(
  baseAppStringsCatalog: UiStringTranslations
): UiStringTranslations {
  return {
    ...baseAppStringsCatalog,
    ...generateNumberStringsCatalog(),
  };
}

export function main(): void {
  let appStringsCatalog = safeParseJson(
    fs.readFileSync(APP_STRINGS_CATALOG_FILE_PATH).toString('utf8'),
    UiStringTranslationsSchema
  ).unsafeUnwrap();

  appStringsCatalog = addNumberStrings(appStringsCatalog);

  const sortedAppStringsCatalog: UiStringTranslations = {};
  for (const appStringKey of Object.keys(appStringsCatalog).sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true })
  )) {
    sortedAppStringsCatalog[appStringKey] = appStringsCatalog[appStringKey];
  }

  fs.writeFileSync(
    APP_STRINGS_CATALOG_FILE_PATH,
    `${JSON.stringify(sortedAppStringsCatalog, undefined, 2)}\n`
  );
}
