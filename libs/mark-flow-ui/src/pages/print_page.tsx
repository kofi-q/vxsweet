import { useCallback, useEffect } from 'react';

import { H1, Font } from '@vx/libs/ui/primitives';
import { Main, Screen } from '@vx/libs/ui/screens';
import { useLock } from '@vx/libs/ui/hooks/use_lock';
import { PrintingBallotImage } from '@vx/libs/ui/ballots';
import { appStrings } from '@vx/libs/ui/ui_strings/ui_string';
import { ReadOnLoad } from '@vx/libs/ui/ui_strings';

export const printingMessageTimeoutSeconds = 5;

export interface PrintPageProps {
  print: () => void;
}

export function PrintPage({ print }: PrintPageProps): JSX.Element {
  const printLock = useLock();

  const printBallot = useCallback(() => {
    /* istanbul ignore if */
    if (!printLock.lock()) return;
    print();
  }, [print, printLock]);

  useEffect(() => {
    void printBallot();
  }, [printBallot]);

  return (
    <Screen>
      <Main centerChild padded>
        <Font align="center">
          <PrintingBallotImage />
          <ReadOnLoad>
            <H1>{appStrings.titleBmdPrintScreen()}</H1>
          </ReadOnLoad>
        </Font>
      </Main>
    </Screen>
  );
}
