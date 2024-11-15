jest.mock(
  '@vx/libs/ui/ui_strings',
  (): typeof import('@vx/libs/ui/ui_strings') => ({
    ...jest.requireActual('@vx/libs/ui/ui_strings'),
    useCurrentLanguage: useCurrentLanguageMock,
  })
);

import React from 'react';
import { QUERY_CLIENT_DEFAULT_OPTIONS } from '@vx/libs/ui/src';
import {
  type Election,
  type ElectionDefinition,
} from '@vx/libs/types/elections';
import { LanguageCode } from '@vx/libs/types/languages';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { generateBallotStyleId } from '@vx/libs/utils/src';
import * as electionGeneral from '@vx/libs/fixtures/src/data/electionGeneral/election.json';
import { useBallotStyleManager } from './use_ballot_style_manager';
import { act, renderHook } from '../../test/react_testing_library';
const electionGeneralDefinition = electionGeneral.toElectionDefinition();

let setMockLanguage: (languageCode: string) => void;
function useCurrentLanguageMock() {
  const [language, setLanguage] = React.useState<string>(LanguageCode.ENGLISH);

  setMockLanguage = (l) => setLanguage(l);

  return language;
}

const queryClient = new QueryClient({
  defaultOptions: QUERY_CLIENT_DEFAULT_OPTIONS,
});

function TestHookWrapper(props: { children: React.ReactNode }) {
  return <QueryClientProvider {...props} client={queryClient} />;
}

const baseElection = electionGeneralDefinition.election;

const ballotLanguages = [LanguageCode.ENGLISH, LanguageCode.SPANISH];
const [ballotStyleEnglish, ballotStyleSpanish] = ballotLanguages.map(
  (languageCode) => ({
    ...baseElection.ballotStyles[0],
    id: generateBallotStyleId({
      ballotStyleIndex: 1,
      languages: [languageCode],
    }),
    languages: [languageCode],
  })
);

const election: Election = {
  ...baseElection,
  ballotStyles: [ballotStyleEnglish, ballotStyleSpanish],
};
const electionDefinition: ElectionDefinition = {
  ...electionGeneralDefinition,
  election,
};

test('updates ballot style when language changes', () => {
  const mockUpdateFn = jest.fn();

  renderHook(
    () =>
      useBallotStyleManager({
        currentBallotStyleId: ballotStyleEnglish.id,
        electionDefinition,
        updateCardlessVoterBallotStyle: mockUpdateFn,
      }),
    { wrapper: TestHookWrapper }
  );

  mockUpdateFn.mockClear();
  act(() => setMockLanguage(LanguageCode.SPANISH));

  expect(mockUpdateFn).toHaveBeenCalledTimes(1);
  expect(mockUpdateFn).toHaveBeenCalledWith({
    ballotStyleId: ballotStyleSpanish.id,
  });
});

test('is a no-op for unchanged language', () => {
  const mockUpdateFn = jest.fn();

  renderHook(
    () =>
      useBallotStyleManager({
        currentBallotStyleId: ballotStyleEnglish.id,
        electionDefinition,
        updateCardlessVoterBallotStyle: mockUpdateFn,
      }),
    { wrapper: TestHookWrapper }
  );

  mockUpdateFn.mockClear();
  act(() => setMockLanguage(LanguageCode.ENGLISH));

  expect(mockUpdateFn).not.toHaveBeenCalled();
});

test('is a no-op for undefined initial ballot style ID', () => {
  const mockUpdateFn = jest.fn();

  renderHook(
    () =>
      useBallotStyleManager({
        electionDefinition,
        updateCardlessVoterBallotStyle: mockUpdateFn,
      }),
    { wrapper: TestHookWrapper }
  );

  act(() => setMockLanguage(LanguageCode.SPANISH));

  expect(mockUpdateFn).not.toHaveBeenCalled();
});

test('is a no-op for undefined election definition', () => {
  const mockUpdateFn = jest.fn();

  renderHook(
    () =>
      useBallotStyleManager({
        currentBallotStyleId: ballotStyleEnglish.id,
        updateCardlessVoterBallotStyle: mockUpdateFn,
      }),
    { wrapper: TestHookWrapper }
  );

  act(() => setMockLanguage(LanguageCode.SPANISH));

  expect(mockUpdateFn).not.toHaveBeenCalled();
});
