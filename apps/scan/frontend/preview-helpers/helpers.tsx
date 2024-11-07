/* istanbul ignore file */

import { type ElectionDefinition } from '@vx/libs/types/src';
import { assert } from '@vx/libs/basics/assert';
import React from 'react';

interface PreviewContextValues {
  electionDefinition: ElectionDefinition;
}

const PreviewContext = React.createContext<PreviewContextValues | undefined>(
  undefined
);

export function usePreviewContext(): PreviewContextValues {
  const context = React.useContext(PreviewContext);
  assert(context, 'PreviewContext.Provider not found');
  return context;
}

export interface PreviewableModule {
  [key: string]: unknown;
}

export interface PreviewableComponent {
  componentId: string;
  componentName: string;
  previews: readonly ComponentPreview[];
}

export interface ComponentPreview {
  componentId: string;
  componentName: string;
  previewId: string;
  previewName: string;
  previewComponent: React.FC<unknown>;
}

export const PREVIEW_COMPONENT_SUFFIX = 'Preview';

function asTitle(id: string): string {
  return id.split(/(?=[A-Z\d]+)/).join(' ');
}

function extractComponents(mod: PreviewableModule): Array<React.FC<unknown>> {
  return Object.entries(mod).flatMap<React.FC<unknown>>(
    ([exportName, exportValue]) =>
      typeof exportValue === 'function' &&
      exportValue.name === exportName &&
      /^[A-Z][a-zA-Z0-9]+$/.test(exportName)
        ? (exportValue as React.FC<unknown>)
        : []
  );
}

export function getPreviews(
  mod: PreviewableModule
): PreviewableComponent | undefined {
  const components = extractComponents(mod);
  const previewComponents = components.filter((component) =>
    component.name.endsWith(PREVIEW_COMPONENT_SUFFIX)
  );
  const nonPreviewComponents = components.filter(
    (component) => !component.name.endsWith(PREVIEW_COMPONENT_SUFFIX)
  );

  if (nonPreviewComponents.length === 0 || previewComponents.length === 0) {
    return;
  }

  assert(nonPreviewComponents.length === 1);
  const [previewableComponent] = nonPreviewComponents;
  const componentId = previewableComponent.name;
  const componentName = asTitle(previewableComponent.name);
  const previews = previewComponents.map((previewComponent) => ({
    componentId,
    componentName,
    previewId: previewComponent.name,
    previewName: asTitle(
      previewComponent.name.slice(0, -PREVIEW_COMPONENT_SUFFIX.length)
    ),
    previewComponent,
  }));

  return { componentId, componentName, previews };
}
