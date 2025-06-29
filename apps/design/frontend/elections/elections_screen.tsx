import { type Result } from '@vx/libs/basics/result';
import { type ElectionId } from '@vx/libs/types/elections';
import { type Id } from '@vx/libs/types/basic';
import { H1, P, Icons } from '@vx/libs/ui/primitives';
import { Button } from '@vx/libs/ui/buttons';
import { MainContent, MainHeader } from '@vx/libs/ui/screens';
import { FileInputButton, Table } from '@vx/libs/ui/src';
import { FormEvent } from 'react';
import { useHistory } from 'react-router-dom';
import styled from 'styled-components';
import { format } from '@vx/libs/utils/src';
import { listElections, createElection, loadElection } from '../api/api';
import { Column, Row } from '../layout/layout';
import { NavScreen } from '../layout/nav_screen';
import { generateId } from '../util/utils';

const ButtonRow = styled.tr`
  cursor: pointer;

  & td {
    padding: 0.75rem 0.5rem;
  }

  &:hover {
    background-color: ${(p) => p.theme.colors.containerLow};
  }
`;

export function ElectionsScreen(): JSX.Element | null {
  const listElectionsQuery = listElections.useQuery();
  const createElectionMutation = createElection.useMutation();
  const loadElectionMutation = loadElection.useMutation();
  const history = useHistory();

  function onCreateElectionSuccess(result: Result<Id, Error>) {
    if (result.isOk()) {
      const electionId = result.ok();
      history.push(`/elections/${electionId}`);
      return;
    }
    // TODO handle error case
    throw result.err();
  }

  async function onSelectElectionFile(event: FormEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const files = Array.from(input.files || []);
    const file = files[0];
    const electionData = await file.text();
    loadElectionMutation.mutate(
      { electionData },
      { onSuccess: onCreateElectionSuccess }
    );
  }

  function onCreateElectionPress() {
    createElectionMutation.mutate(
      { id: generateId() as ElectionId },
      { onSuccess: onCreateElectionSuccess }
    );
  }

  if (!listElectionsQuery.isSuccess) {
    return null;
  }
  const elections = listElectionsQuery.data;

  return (
    <NavScreen>
      <MainHeader>
        <H1>Elections</H1>
      </MainHeader>
      <MainContent>
        <Column style={{ gap: '1rem' }}>
          {elections.length === 0 ? (
            <P>
              <Icons.Info /> You haven&apos;t created any elections yet.
            </P>
          ) : (
            <Table>
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Date</th>
                  <th>Jurisdiction</th>
                  <th>State</th>
                </tr>
              </thead>
              <tbody>
                {elections.map(({ election }) => (
                  <ButtonRow
                    key={election.id}
                    onClick={() => history.push(`/elections/${election.id}`)}
                  >
                    <td>{election.title || 'Untitled Election'}</td>
                    <td>
                      {election.date &&
                        format.localeLongDate(
                          election.date.toMidnightDatetimeWithSystemTimezone()
                        )}
                    </td>
                    <td>{election.county.name}</td>
                    <td>{election.state}</td>
                  </ButtonRow>
                ))}
              </tbody>
            </Table>
          )}
          <Row style={{ gap: '0.5rem' }}>
            <Button
              variant={elections.length === 0 ? 'primary' : undefined}
              icon="Add"
              onPress={onCreateElectionPress}
              disabled={createElectionMutation.isLoading}
            >
              Create Election
            </Button>
            <FileInputButton
              accept=".json"
              onChange={onSelectElectionFile}
              disabled={createElectionMutation.isLoading}
            >
              Load Election
            </FileInputButton>
          </Row>
        </Column>
      </MainContent>
    </NavScreen>
  );
}
