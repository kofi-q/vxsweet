import { BigMetric } from '@vx/libs/ui/src';
import { appStrings } from '@vx/libs/ui/src/ui_strings';
import styled from 'styled-components';

interface Props {
  count: number;
}

const BallotsScannedContainer = styled.div`
  display: inline-block;
`;

export function ScannedBallotCount({ count }: Props): JSX.Element {
  return (
    <BallotsScannedContainer>
      <BigMetric
        label={appStrings.labelNumBallotsScanned()}
        value={count}
        valueElementTestId="ballot-count"
      />
    </BallotsScannedContainer>
  );
}
