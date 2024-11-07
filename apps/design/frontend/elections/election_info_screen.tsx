import React, { useState } from 'react';
import { type Election, type Id } from '@vx/libs/types/src';
import { Button, SegmentedButton } from '@vx/libs/ui/buttons';
import { H1 } from '@vx/libs/ui/primitives';
import { MainContent, MainHeader } from '@vx/libs/ui/screens';
import { useHistory, useParams } from 'react-router-dom';
import styled from 'styled-components';
import { DateWithoutTime } from '@vx/libs/basics/time';
import { deleteElection, getElection, updateElection } from '../api/api';
import { FieldName, Form, FormActionsRow, InputGroup } from '../layout/layout';
import { ElectionNavScreen } from '../layout/nav_screen';
import { routes } from '../routes/routes';
import { ImageInput } from '../image-input/image_input';

type ElectionInfo = Pick<
  Election,
  'title' | 'date' | 'type' | 'state' | 'county' | 'seal'
>;

const SealImageInput = styled(ImageInput)`
  img {
    width: 10rem;
  }
`;

function hasBlankElectionInfo(election: Election): boolean {
  return (
    election.title === '' &&
    election.state === '' &&
    election.county.name === '' &&
    election.seal === ''
  );
}

function ElectionInfoForm({
  electionId,
  savedElection,
}: {
  electionId: Id;
  savedElection: Election;
}): JSX.Element {
  const [isEditing, setIsEditing] = useState(
    // Default to editing for newly created elections
    hasBlankElectionInfo(savedElection)
  );
  const [electionInfo, setElectionInfo] = useState<ElectionInfo>(savedElection);
  const updateElectionMutation = updateElection.useMutation();
  const deleteElectionMutation = deleteElection.useMutation();
  const history = useHistory();

  function onSaveButtonPress() {
    updateElectionMutation.mutate(
      { electionId, election: { ...savedElection, ...electionInfo } },
      { onSuccess: () => setIsEditing(false) }
    );
  }

  function onInputChange(field: keyof ElectionInfo) {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      setElectionInfo((prev) => ({ ...prev, [field]: e.target.value }));
    };
  }

  function onDeletePress() {
    deleteElectionMutation.mutate(
      { electionId },
      {
        onSuccess: () => {
          history.push(routes.root.path);
        },
      }
    );
  }

  return (
    <Form>
      <InputGroup label="Title">
        <input
          type="text"
          value={electionInfo.title}
          onChange={onInputChange('title')}
          disabled={!isEditing}
        />
      </InputGroup>
      <InputGroup label="Date">
        <input
          type="date"
          value={electionInfo.date.toISOString()}
          onChange={(e) =>
            setElectionInfo({
              ...electionInfo,
              date: new DateWithoutTime(e.target.value),
            })
          }
          disabled={!isEditing}
        />
      </InputGroup>
      <SegmentedButton
        label="Type"
        options={[
          { label: 'General', id: 'general' },
          { label: 'Primary', id: 'primary' },
        ]}
        selectedOptionId={electionInfo.type}
        onChange={(type) => setElectionInfo({ ...electionInfo, type })}
        disabled={!isEditing}
      />
      <InputGroup label="State">
        <input
          type="text"
          value={electionInfo.state}
          onChange={onInputChange('state')}
          disabled={!isEditing}
        />
      </InputGroup>
      <InputGroup label="Jurisdiction">
        <input
          type="text"
          value={electionInfo.county.name}
          onChange={(e) =>
            setElectionInfo({
              ...electionInfo,
              county: {
                name: e.target.value,
                id: 'county-id',
              },
            })
          }
          disabled={!isEditing}
        />
      </InputGroup>
      <div>
        <FieldName>Seal</FieldName>
        <SealImageInput
          value={electionInfo.seal}
          onChange={(seal) => setElectionInfo({ ...electionInfo, seal })}
          disabled={!isEditing}
          buttonLabel="Upload Seal Image"
        />
      </div>

      {isEditing ? (
        <FormActionsRow>
          <Button
            onPress={() => {
              setElectionInfo(savedElection);
              setIsEditing(false);
            }}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            icon="Done"
            onPress={onSaveButtonPress}
            disabled={updateElectionMutation.isLoading}
          >
            Save
          </Button>
        </FormActionsRow>
      ) : (
        <div>
          <FormActionsRow>
            <Button
              variant="primary"
              icon="Edit"
              onPress={() => setIsEditing(true)}
            >
              Edit
            </Button>
          </FormActionsRow>
          <FormActionsRow style={{ marginTop: '1rem' }}>
            <Button
              variant="danger"
              icon="Delete"
              onPress={onDeletePress}
              disabled={deleteElectionMutation.isLoading}
            >
              Delete Election
            </Button>
          </FormActionsRow>
        </div>
      )}
    </Form>
  );
}

export function ElectionInfoScreen(): JSX.Element | null {
  const { electionId } = useParams<{ electionId: string }>();
  const getElectionQuery = getElection.useQuery(electionId);

  if (!getElectionQuery.isSuccess) {
    return null;
  }

  const { election } = getElectionQuery.data;

  return (
    <ElectionNavScreen electionId={electionId}>
      <MainHeader>
        <H1>Election Info</H1>
      </MainHeader>
      <MainContent>
        <ElectionInfoForm electionId={electionId} savedElection={election} />
      </MainContent>
    </ElectionNavScreen>
  );
}
