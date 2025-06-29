import * as electionGeneral from '@vx/libs/fixtures/src/data/electionGeneral/election.json';
import {
  ALL_PRECINCTS_SELECTION,
  singlePrecinctSelectionFor,
} from '@vx/libs/utils/src';
import { formatElectionHashes } from '@vx/libs/types/elections';
import { hasTextAcrossElements } from '@vx/libs/test-utils/src';
import { render, screen, within } from '../test/react_testing_library';
import { ElectionInfoBar, VerticalElectionInfoBar } from './election_info_bar';
import { makeTheme } from '../themes/make_theme';
const electionGeneralDefinition = electionGeneral.toElectionDefinition();

const mockElectionPackageHash = '1111111111111111111111111';

describe('ElectionInfoBar', () => {
  test('Renders with appropriate information', () => {
    render(
      <ElectionInfoBar
        electionDefinition={electionGeneralDefinition}
        electionPackageHash={mockElectionPackageHash}
        machineId="0000"
        codeVersion="DEV"
        mode="admin"
      />
    );
    screen.getByText('General Election');
    screen.getByText('November 3, 2020');
    screen.getByText('Franklin County');
    screen.getByText('State of Hamilton');

    const versionLabel = screen.getByText('Version');
    expect(versionLabel.parentElement?.lastChild).toHaveTextContent('DEV');

    const machineIdLabel = screen.getByText('Machine ID');
    expect(machineIdLabel.parentElement?.lastChild).toHaveTextContent('0000');

    const electionIdLabel = screen.getByText('Election ID');
    expect(electionIdLabel.parentElement?.lastChild).toHaveTextContent(
      formatElectionHashes(
        electionGeneralDefinition.ballotHash,
        mockElectionPackageHash
      )
    );
  });

  test('Renders with all precincts when specified', () => {
    render(
      <ElectionInfoBar
        electionDefinition={electionGeneralDefinition}
        electionPackageHash={mockElectionPackageHash}
        machineId="0000"
        codeVersion="DEV"
        mode="admin"
        precinctSelection={ALL_PRECINCTS_SELECTION}
      />
    );
    screen.getByText('All Precincts');
  });

  test('Renders with specific precinct', () => {
    render(
      <ElectionInfoBar
        electionDefinition={electionGeneralDefinition}
        electionPackageHash={mockElectionPackageHash}
        machineId="0002"
        codeVersion="DEV"
        mode="admin"
        precinctSelection={singlePrecinctSelectionFor('23')}
      />
    );
    screen.getByText('Center Springfield');
  });

  test('Renders without admin info in default voter mode', () => {
    render(
      <ElectionInfoBar
        electionDefinition={electionGeneralDefinition}
        electionPackageHash={mockElectionPackageHash}
        machineId="0002"
        codeVersion="DEV"
        precinctSelection={singlePrecinctSelectionFor('23')}
      />
    );
    expect(screen.queryByText(/Version/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Machined ID/)).not.toBeInTheDocument();
  });

  test('Renders seal', () => {
    render(
      <ElectionInfoBar
        electionDefinition={electionGeneralDefinition}
        electionPackageHash={mockElectionPackageHash}
      />
    );
    screen.getByTestId('seal');
  });

  test('Renders inverse', () => {
    const theme = makeTheme({ colorMode: 'desktop', sizeMode: 'desktop' });
    const { container } = render(
      <ElectionInfoBar
        electionDefinition={electionGeneralDefinition}
        electionPackageHash={mockElectionPackageHash}
        inverse
      />,
      { vxTheme: theme }
    );
    const infoBar = container.firstChild;
    expect(infoBar).toHaveStyle({
      background: theme.colors.inverseBackground,
      color: theme.colors.onInverse,
    });
  });
});

describe('VerticalElectionInfoBar', () => {
  test('Renders with appropriate information', () => {
    render(
      <VerticalElectionInfoBar
        electionDefinition={electionGeneralDefinition}
        electionPackageHash={mockElectionPackageHash}
        machineId="0000"
        codeVersion="DEV"
        mode="admin"
      />
    );
    screen.getByText('General Election');
    screen.getByText('November 3, 2020');
    screen.getByText('Franklin County');
    screen.getByText('State of Hamilton');

    screen.getByText(hasTextAcrossElements('Version: DEV'));
    screen.getByText(hasTextAcrossElements('Machine ID: 0000'));
    screen.getByText(/Election ID/);
    within(screen.getByText(/Election ID/).parentElement!).getByText(
      formatElectionHashes(
        electionGeneralDefinition.ballotHash,
        mockElectionPackageHash
      )
    );
  });

  test('Renders with all precincts when specified', () => {
    render(
      <VerticalElectionInfoBar
        electionDefinition={electionGeneralDefinition}
        electionPackageHash={mockElectionPackageHash}
        machineId="0000"
        codeVersion="DEV"
        mode="admin"
        precinctSelection={ALL_PRECINCTS_SELECTION}
      />
    );
    screen.getByText('All Precincts');
  });

  test('Renders with specific precinct', () => {
    render(
      <VerticalElectionInfoBar
        electionDefinition={electionGeneralDefinition}
        electionPackageHash={mockElectionPackageHash}
        machineId="0002"
        codeVersion="DEV"
        mode="admin"
        precinctSelection={singlePrecinctSelectionFor('23')}
      />
    );
    screen.getByText('Center Springfield');
  });

  test('Renders without admin info in default voter mode', () => {
    render(
      <VerticalElectionInfoBar
        electionDefinition={electionGeneralDefinition}
        electionPackageHash={mockElectionPackageHash}
        machineId="0002"
        codeVersion="DEV"
        precinctSelection={singlePrecinctSelectionFor('23')}
      />
    );
    expect(screen.queryByText(/Version/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Machined ID/)).not.toBeInTheDocument();
  });

  test('Renders seal', () => {
    render(
      <VerticalElectionInfoBar
        electionDefinition={electionGeneralDefinition}
        electionPackageHash={mockElectionPackageHash}
      />
    );
    screen.getByTestId('seal');
  });

  test('Renders inverse', () => {
    const theme = makeTheme({ colorMode: 'desktop', sizeMode: 'desktop' });
    const { container } = render(
      <VerticalElectionInfoBar
        electionDefinition={electionGeneralDefinition}
        electionPackageHash={mockElectionPackageHash}
        inverse
      />,
      { vxTheme: theme }
    );
    const infoBar = container.firstChild;
    expect(infoBar).toHaveStyle({
      background: theme.colors.inverseBackground,
      color: theme.colors.onInverse,
    });
  });
});
