import React, { useState } from 'react';
import {
  type Election,
  type PrecinctSelection,
} from '@vx/libs/types/elections';
import {
  ALL_PRECINCTS_NAME,
  ALL_PRECINCTS_SELECTION,
  singlePrecinctSelectionFor,
} from '@vx/libs/utils/src';
import { assert } from '@vx/libs/basics/assert';
import { deepEqual } from '@vx/libs/basics/objects';
import styled from 'styled-components';
import { Button } from '../buttons/button';
import { Modal } from '../modal/modal';
import { Font, H1, P } from '../primitives/typography';
import { Icons } from '../primitives/icons';
import { SearchSelect } from '../select/search_select';

const ConfirmModal = styled(Modal)`
  overflow: visible;

  > div:first-child {
    position: relative;
    overflow: visible;
  }
`;

export const SELECT_PRECINCT_TEXT = 'Select a precinct…';
export const ALL_PRECINCTS_OPTION_VALUE = 'ALL_PRECINCTS_OPTION_VALUE';

export type ChangePrecinctMode =
  | 'default'
  | 'confirmation_required'
  | 'disabled';

export interface ChangePrecinctButtonProps {
  appPrecinctSelection?: PrecinctSelection;
  updatePrecinctSelection: (
    precinctSelection: PrecinctSelection
  ) => Promise<void>;
  election: Election;
  mode: ChangePrecinctMode;
}

export function ChangePrecinctButton({
  appPrecinctSelection,
  updatePrecinctSelection,
  election,
  mode,
}: ChangePrecinctButtonProps): JSX.Element {
  const [isConfirmationModalShowing, setIsConfirmationModalShowing] =
    useState(false);
  const [unconfirmedPrecinctSelection, setUnconfirmedPrecinctSelection] =
    useState<PrecinctSelection>();

  const dropdownPrecinctSelection =
    unconfirmedPrecinctSelection || appPrecinctSelection;

  const dropdownCurrentValue =
    dropdownPrecinctSelection &&
    (dropdownPrecinctSelection.kind === 'AllPrecincts'
      ? ALL_PRECINCTS_OPTION_VALUE
      : dropdownPrecinctSelection.precinctId);

  function openModal() {
    setIsConfirmationModalShowing(true);
  }

  function closeModal() {
    setIsConfirmationModalShowing(false);
    setUnconfirmedPrecinctSelection(undefined);
  }

  async function handlePrecinctSelectionChange(value?: string) {
    assert(value !== undefined);
    const newPrecinctSelection =
      value === ALL_PRECINCTS_OPTION_VALUE
        ? ALL_PRECINCTS_SELECTION
        : singlePrecinctSelectionFor(value);

    if (mode === 'confirmation_required') {
      setUnconfirmedPrecinctSelection(newPrecinctSelection);
    } else {
      await updatePrecinctSelection(newPrecinctSelection);
    }
  }

  async function confirmPrecinctChange() {
    assert(unconfirmedPrecinctSelection);
    await updatePrecinctSelection(unconfirmedPrecinctSelection);
    closeModal();
  }

  const precinctSelectDropdown = (
    <SearchSelect
      isMulti={false}
      placeholder={SELECT_PRECINCT_TEXT}
      ariaLabel={SELECT_PRECINCT_TEXT}
      options={[
        {
          value: ALL_PRECINCTS_OPTION_VALUE,
          label: ALL_PRECINCTS_NAME,
        },
        ...[...election.precincts]
          .sort((a, b) =>
            a.name.localeCompare(b.name, undefined, { ignorePunctuation: true })
          )
          .map((precinct) => ({
            value: precinct.id,
            label: precinct.name,
          })),
      ]}
      value={dropdownCurrentValue}
      onChange={handlePrecinctSelectionChange}
      disabled={mode === 'disabled'}
      style={{ width: '100%' }}
    />
  );

  return mode === 'default' || mode === 'disabled' ? (
    precinctSelectDropdown
  ) : (
    <React.Fragment>
      <Button onPress={openModal}>Change Precinct</Button>
      {isConfirmationModalShowing && (
        <ConfirmModal
          content={
            <div>
              <H1>Change Precinct</H1>
              <P>
                <Icons.Warning color="warning" />{' '}
                <Font weight="bold">Warning:</Font> Changing the precinct will
                close the polls.
              </P>
              {precinctSelectDropdown}
            </div>
          }
          actions={
            <React.Fragment>
              <Button
                variant="danger"
                onPress={confirmPrecinctChange}
                disabled={
                  !unconfirmedPrecinctSelection ||
                  deepEqual(unconfirmedPrecinctSelection, appPrecinctSelection)
                }
              >
                Confirm
              </Button>
              <Button onPress={closeModal}>Cancel</Button>
            </React.Fragment>
          }
          onOverlayClick={closeModal}
        />
      )}
    </React.Fragment>
  );
}
