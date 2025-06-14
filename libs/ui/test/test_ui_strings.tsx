/* istanbul ignore file - test utils */

import { LanguageCode } from '@vx/libs/types/languages';
import { type UiStringsPackage } from '@vx/libs/types/ui_strings';

import React from 'react';
import { UiString } from '../ui_strings/ui_string/ui_string';
import { Font } from '../primitives/typography';

export const TEST_UI_STRING_KEY = 'numPlanets';

export const TEST_UI_STRING_TRANSLATIONS: UiStringsPackage = {
  [LanguageCode.ENGLISH]: {
    [`numPlanets_one`]: 'There is only <2>{{count}}</2> planet.',
    [`numPlanets_other`]: 'There are <2>{{count}}</2> planets.',
    planetName: {
      planet1: 'Mercury',
      planet3: 'Earth',
      planet9: 'Pluto', // #NeverForget
    },
  },
  [LanguageCode.CHINESE_TRADITIONAL]: {
    [`numPlanets_one`]: '只有<2>{{count}}</2>個行星。',
    [`numPlanets_other`]: '有 <2>{{count}}</2> 個行星。',
    planetName: {
      planet1: '水星',
      planet3: '地球',
      planet9: '冥王星',
    },
  },
  [LanguageCode.SPANISH]: {
    [`numPlanets_one`]: 'Sólo hay <2>{{count}}</2> planeta.',
    [`numPlanets_other`]: 'Hay <2>{{count}}</2> planetas.',
    planetName: {
      planet1: 'Mercurio',
      planet3: 'Tierra',
      planet9: 'Plutón',
    },
  },
};

export const testUiStrings = {
  numPlanets: (count: number) => (
    <UiString pluralCount={count} uiStringKey={TEST_UI_STRING_KEY}>
      [Untranslated] There are{' '}
      <Font weight="bold">{{ count } as unknown as string}</Font> planets.
    </UiString>
  ),
  planetName: (planetId: string) => (
    <UiString uiStringKey="planetName" uiStringSubKey={planetId}>
      {planetId}
    </UiString>
  ),
} as const;

// Using `testUiStrings.numPlanets()` directly in Storybook, doesn't work, for
// some reason. This is a convenience wrapper to avoid the failure, which seems
// related to rendering the count param object as a React component child.
export function NumPlanets(props: { pluralCount: number }): JSX.Element {
  const { pluralCount } = props;

  return (
    <React.Fragment>{testUiStrings.numPlanets(pluralCount)}</React.Fragment>
  );
}
