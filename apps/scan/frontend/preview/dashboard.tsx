/* istanbul ignore file */

import { type ElectionDefinition } from '@vx/libs/types/elections';
import { safeParseElectionDefinition } from '@vx/libs/types/election-parsing';
import { H1, H4, Prose } from '@vx/libs/ui/primitives';
import { Select } from '@vx/libs/ui/select';
import React, { useRef, useState } from 'react';
import { BrowserRouter, Link, Route } from 'react-router-dom';
import styled from 'styled-components';
import { createApiClient } from '../api/api';
import { Paths } from '../constants/constants';
import { VoterSettingsScreen } from '../screens/voter/voter_settings_screen';
import { ApiProvider } from '../api/api_provider';
import {
  type PreviewableModule,
  type ComponentPreview,
  getPreviews,
} from '../preview-helpers/helpers';

interface PreviewContextValues {
  electionDefinition: ElectionDefinition;
}

const PreviewContext = React.createContext<PreviewContextValues | undefined>(
  undefined
);

const PreviewColumns = styled.div`
  columns: 2;

  @media (orientation: landscape) {
    columns: 3;
  }

  & > div {
    margin-bottom: 2rem;
    break-inside: avoid;
  }
`;

export interface Props {
  modules: readonly PreviewableModule[];
  electionDefinitions: readonly ElectionDefinition[];
}

function getPreviewUrl(preview: ComponentPreview): string {
  return `/preview/${preview.componentId}/${preview.previewId}`;
}

const ConfigBox = styled.div`
  position: absolute;
  top: 20px;
  right: 10px;
  width: auto;
`;

export function PreviewDashboard({
  modules,
  electionDefinitions: initialElectionDefinitions,
}: Props): JSX.Element {
  const previewables = modules.flatMap((mod) => getPreviews(mod) ?? []);
  const [electionDefinition, setElectionDefinition] = useState(
    initialElectionDefinitions[0]
  );
  const [electionDefinitions, setElectionDefinitions] = useState(
    initialElectionDefinitions
  );
  const electionDefinitionFileRef = useRef<HTMLInputElement>(null);

  const onElectionDefinitionSelected: React.ChangeEventHandler<
    HTMLSelectElement
  > = (event) => {
    const { value } = event.target.selectedOptions[0];
    if (value === 'custom') {
      electionDefinitionFileRef.current?.click();
    } else {
      setElectionDefinition(electionDefinitions[event.target.selectedIndex]);
    }
  };
  const onElectionDefinitionFileChosen: React.ChangeEventHandler<
    HTMLInputElement
  > = async (event) => {
    const file = event.target.files?.[0];
    if (file) {
      const json = await file.text();
      const result = safeParseElectionDefinition(json);
      if (result.isOk()) {
        setElectionDefinitions((prev) => [...prev, result.ok()]);
        setElectionDefinition(result.ok());
      }
    }
  };

  return (
    <PreviewContext.Provider value={{ electionDefinition }}>
      <ApiProvider apiClient={createApiClient()} enableStringTranslation>
        <BrowserRouter>
          <Route path={Paths.VOTER_SETTINGS} exact>
            <VoterSettingsScreen />
          </Route>
          <Route path="/preview" exact>
            <div style={{ height: '100%', overflow: 'auto' }}>
              <H1>Previews</H1>
              <PreviewColumns>
                {previewables.map(({ componentName, previews }) => {
                  return (
                    <Prose key={componentName}>
                      <H4>{componentName}</H4>
                      <ul>
                        {previews.map((preview) => (
                          <li key={preview.previewName}>
                            <Link to={getPreviewUrl(preview)}>
                              {preview.previewName}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </Prose>
                  );
                })}
              </PreviewColumns>
              <ConfigBox>
                <Select
                  value={electionDefinition.ballotHash}
                  onChange={onElectionDefinitionSelected}
                >
                  <optgroup label="Presets">
                    {initialElectionDefinitions.map(
                      ({ election, ballotHash }) => (
                        <option key={ballotHash} value={ballotHash}>
                          {election.title}
                        </option>
                      )
                    )}
                  </optgroup>
                  <optgroup label="Custom">
                    {electionDefinitions
                      .slice(initialElectionDefinitions.length)
                      .map(({ election, ballotHash }) => (
                        <option key={ballotHash} value={ballotHash}>
                          {election.title}
                        </option>
                      ))}
                    <option value="custom">Load from file…</option>
                  </optgroup>
                </Select>
                <input
                  ref={electionDefinitionFileRef}
                  style={{ display: 'none' }}
                  type="file"
                  onChange={onElectionDefinitionFileChosen}
                />
              </ConfigBox>
            </div>
          </Route>
          {previewables.map((previewable) =>
            previewable.previews.map((preview) => (
              <Route
                key={preview.previewName}
                path={getPreviewUrl(preview)}
                component={preview.previewComponent}
              />
            ))
          )}
        </BrowserRouter>
      </ApiProvider>
    </PreviewContext.Provider>
  );
}
