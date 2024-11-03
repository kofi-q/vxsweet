import {
  renderWithThemes,
  type VxRenderOptions,
  type VxRenderResult,
  vxTestingLibraryScreen,
  vxTestingLibraryWithinFn,
} from '../themes/render_with_themes';

// Re-export all of @testing-library/react for convenience and override
// with customized VX utils and types, as recommended at
// https://testing-library.com/docs/react-testing-library/setup/#custom-render
import {
  act,
  cleanup,
  fireEvent,
  getByTestId,
  getByText,
  MatcherFunction,
  renderHook,
  waitFor,
  waitForElementToBeRemoved,
} from '@testing-library/react';
export {
  act,
  cleanup,
  fireEvent,
  getByTestId,
  getByText,
  type MatcherFunction,
  renderHook,
  waitFor,
  waitForElementToBeRemoved,
};
export { renderWithThemes as render };
export { vxTestingLibraryScreen as screen };
export { vxTestingLibraryWithinFn as within };
export type { VxRenderOptions as RenderOptions };
export type { VxRenderResult as RenderResult };
