import { BigMetric } from '@vx/libs/ui/text-elements';
import { appStrings } from '@vx/libs/ui/ui_strings/ui_string';
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
