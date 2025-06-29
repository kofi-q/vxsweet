jest.mock(
  '../ui_strings/ui_string/ui_string',
  (): typeof import('../ui_strings/ui_string/ui_string') => ({
    ...jest.requireActual('../ui_strings/ui_string/ui_string'),
    UiString: jest.fn(),
  })
);

jest.mock(
  '../ui_strings/screen-reader/use_audio_controls',
  (): typeof import('../ui_strings/screen-reader/use_audio_controls') => ({
    ...jest.requireActual('../ui_strings/screen-reader/use_audio_controls'),
    useAudioControls: () => mockAudioControls,
  })
);

import {
  advanceTimers,
  mockUseAudioControls,
  mockOf,
} from '@vx/libs/test-utils/src';
import React from 'react';
import { assert } from '@vx/libs/basics/assert';
import { simulateKeyPress as baseSimulateKeyPress } from './test_utils';
import { UiString } from '../ui_strings/ui_string/ui_string';
import {
  type AccessibleControllerHelpStrings,
  type AccessibleControllerIllustrationProps,
  AccessibleControllerSandbox,
} from './accessible_controller_sandbox';
import { act, screen } from '../test/react_testing_library';
import { Keybinding } from '../keybindings/keybindings';
import { newTestContext } from '../test/test_context';

const mockAudioControls = mockUseAudioControls();

function newRenderer() {
  let lastReadElement: HTMLElement;

  const mockOnClick = jest.fn().mockImplementation((event: MouseEvent) => {
    assert(event.target instanceof HTMLElement);
    lastReadElement = event.target;
  });

  const { render } = newTestContext();

  function renderWithMockScreenReader(ui: React.ReactNode) {
    return render(<div onClickCapture={mockOnClick}>{ui}</div>);
  }

  return {
    expectLastMockScreenReaderContent: (textContent: string) =>
      expect(lastReadElement).toHaveTextContent(textContent),
    renderWithMockScreenReader,
  };
}

function simulateKeyPress(key: string) {
  baseSimulateKeyPress(key);
  advanceTimers();
}

type MockIllustrationButton = Keybinding.PAGE_NEXT | Keybinding.PAGE_PREVIOUS;
type MockIllustrationProps =
  AccessibleControllerIllustrationProps<MockIllustrationButton>;

function MockIllustration(props: MockIllustrationProps) {
  const { highlight } = props;
  return <div>MockIllustration - highlight:{highlight}</div>;
}

function expectMockIllustrationProps(highlight?: MockIllustrationButton) {
  screen.getByText(`MockIllustration - highlight:${highlight || ''}`);
}

beforeAll(() => {
  jest.useFakeTimers();
});

test('provides audio feedback for all relevant buttons', async () => {
  mockOf(UiString).mockImplementation((p) => <span>{p.uiStringKey}</span>);

  const { expectLastMockScreenReaderContent, renderWithMockScreenReader } =
    newRenderer();

  const helpStrings: AccessibleControllerHelpStrings<MockIllustrationButton> = {
    [Keybinding.PAGE_NEXT]: 'helpBmdControllerButtonPageNext',
    [Keybinding.PAGE_PREVIOUS]: 'helpBmdControllerButtonPagePrevious',
  };

  renderWithMockScreenReader(
    <AccessibleControllerSandbox
      feedbackStringKeys={helpStrings}
      illustration={MockIllustration}
      introAudioStringKey="instructionsBmdControllerSandboxMarkScan"
    />
  );

  await screen.findByRole('heading', { name: /controller help/i });

  expectLastMockScreenReaderContent('instructionsBmdControllerSandboxMarkScan');
  expectMockIllustrationProps(undefined);

  act(() => simulateKeyPress(Keybinding.PAGE_NEXT));
  expectLastMockScreenReaderContent('helpBmdControllerButtonPageNext');
  expectMockIllustrationProps(Keybinding.PAGE_NEXT);

  act(() => simulateKeyPress(Keybinding.PAGE_PREVIOUS));
  expectLastMockScreenReaderContent('helpBmdControllerButtonPagePrevious');
  expectMockIllustrationProps(Keybinding.PAGE_PREVIOUS);

  // Expect no screen reader events for unconfigured keybindings:
  act(() => simulateKeyPress(Keybinding.FOCUS_NEXT));
  act(() => simulateKeyPress(Keybinding.SELECT));
  expectLastMockScreenReaderContent('helpBmdControllerButtonPagePrevious');
  expectMockIllustrationProps(undefined);
});

test('force-enables audio and disables audio controls while active', async () => {
  mockOf(UiString).mockImplementation((p) => <span>{p.uiStringKey}</span>);

  const helpStrings: AccessibleControllerHelpStrings<MockIllustrationButton> = {
    [Keybinding.PAGE_NEXT]: 'helpBmdControllerButtonPageNext',
    [Keybinding.PAGE_PREVIOUS]: 'helpBmdControllerButtonPagePrevious',
  };

  const { render } = newTestContext();
  const { rerender } = render(<div>Regular Voter Screen</div>);

  await screen.findByText('Regular Voter Screen');
  expect(mockAudioControls.setControlsEnabled).not.toHaveBeenCalled();
  expect(mockAudioControls.setIsEnabled).not.toHaveBeenCalled();

  rerender(
    <AccessibleControllerSandbox
      feedbackStringKeys={helpStrings}
      illustration={MockIllustration}
      introAudioStringKey="instructionsBmdControllerSandboxMarkScan"
    />
  );

  await screen.findByRole('heading', { name: /controller help/i });
  expect(mockAudioControls.setControlsEnabled).toHaveBeenLastCalledWith(false);
  expect(mockAudioControls.setIsEnabled).toHaveBeenLastCalledWith(true);

  // Reset audio control mocks so we can verify there are no further calls to
  // `setIsEnabled`:
  mockAudioControls.setIsEnabled.mockReset();
  mockAudioControls.setControlsEnabled.mockReset();

  rerender(<div>Regular Voter Screen</div>);

  await screen.findByText('Regular Voter Screen');
  expect(mockAudioControls.setControlsEnabled).toHaveBeenLastCalledWith(true);
  expect(mockAudioControls.setIsEnabled).not.toHaveBeenCalled();
});
