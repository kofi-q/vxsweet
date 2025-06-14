jest.mock(
  '@vx/libs/ui/ui_strings',
  (): typeof import('@vx/libs/ui/ui_strings') => ({
    ...jest.requireActual('@vx/libs/ui/ui_strings'),
    ReadOnLoad: jest.fn(),
  })
);
jest.mock(
  '@vx/libs/ui/ui_strings/screen-reader',
  (): typeof import('@vx/libs/ui/ui_strings/screen-reader') => ({
    ...jest.requireActual('@vx/libs/ui/ui_strings/screen-reader'),
    useAudioControls: () => mockAudioControls,
  })
);

import userEvent from '@testing-library/user-event';
import { DateTime } from 'luxon';
import { mockUseAudioControls, mockOf } from '@vx/libs/test-utils/src';
import { Keybinding } from '@vx/libs/ui/keybindings';
import { ReadOnLoad } from '@vx/libs/ui/ui_strings';
import { render, screen, within } from '../../test/react_testing_library';
import {
  AccessibleControllerDiagnosticScreen,
  type AccessibleControllerDiagnosticProps,
} from './accessible_controller';

const mockAudioControls = mockUseAudioControls();

const now = DateTime.fromISO('2022-03-23T11:23:00.000Z');

function renderScreen(
  props: Partial<AccessibleControllerDiagnosticProps> = {}
) {
  return render(
    <AccessibleControllerDiagnosticScreen
      onComplete={jest.fn()}
      onCancel={jest.fn()}
      {...props}
    />
  );
}

jest.useFakeTimers();

const MOCK_READ_ON_LOAD_TEST_ID = 'mockReadOnLoad';

beforeEach(() => {
  mockOf(ReadOnLoad).mockImplementation((props) => (
    <div data-testid={MOCK_READ_ON_LOAD_TEST_ID} {...props} />
  ));
});

describe('Accessible Controller Diagnostic Screen', () => {
  beforeEach(() => {
    jest.setSystemTime(new Date(now.toISO()));
  });

  it('yields a success result when all steps are completed', async () => {
    const onComplete = jest.fn();
    renderScreen({ onComplete });

    screen.getByText('Accessible Controller Test');

    function expectToHaveIllustrationHighlight(
      highlightTestId: string,
      hasHeadphones?: boolean
    ) {
      const illustration = screen
        .getByTitle('Accessible Controller Illustration')
        .closest('svg') as unknown as HTMLElement;
      const path = within(illustration).getByTestId(highlightTestId);
      expect(path).toHaveAttribute('fill', '#985aa3');
      if (!hasHeadphones) {
        expect(
          within(illustration).queryByTestId('headphones')
        ).not.toBeInTheDocument();
      }
    }

    screen.getByText(/Step 1 of 6/);
    screen.getByText('Press the up button.');
    expectToHaveIllustrationHighlight('up-button');
    // Try out pressing an incorrect button to make sure we actually detect the
    // right button.
    userEvent.keyboard(`{${Keybinding.FOCUS_NEXT}}`);
    screen.getByText(/Step 1 of 6/);
    // Then press the up button.
    // We have to wrap key presses in act to avoid a warning. This may be due to
    // the fact that the keyDown listener is attached to the document instead of
    // a React component.
    userEvent.keyboard(`{${Keybinding.FOCUS_PREVIOUS}}`);

    await screen.findByText(/Step 2 of 6/);
    screen.getByText('Press the down button.');
    expectToHaveIllustrationHighlight('down-button');
    userEvent.keyboard(`{${Keybinding.FOCUS_NEXT}}`);

    await screen.findByText(/Step 3 of 6/);
    screen.getByText('Press the left button.');
    expectToHaveIllustrationHighlight('left-button');
    userEvent.keyboard(`{${Keybinding.PAGE_PREVIOUS}}`);

    await screen.findByText(/Step 4 of 6/);
    screen.getByText('Press the right button.');
    expectToHaveIllustrationHighlight('right-button');
    userEvent.keyboard(`{${Keybinding.PAGE_NEXT}}`);

    await screen.findByText(/Step 5 of 6/);
    screen.getByText('Press the select button.');
    expectToHaveIllustrationHighlight('select-button');
    userEvent.keyboard(`{${Keybinding.SELECT}}`);

    await screen.findByText(/Step 6 of 6/);
    screen.getByText('Confirm sound is working.');
    expectToHaveIllustrationHighlight('right-button', true);
    expectToHaveIllustrationHighlight('headphones', true);
    // Try pressing the select button before playing sound to make sure it
    // doesn't work
    userEvent.keyboard(`{${Keybinding.SELECT}}`);
    expect(onComplete).not.toHaveBeenCalled();
    expect(
      screen.queryByTestId(MOCK_READ_ON_LOAD_TEST_ID)
    ).not.toBeInTheDocument();

    // Then play sound and confirm
    userEvent.keyboard(`{${Keybinding.PAGE_NEXT}}`);
    expect(mockAudioControls.setIsEnabled).toHaveBeenCalledTimes(1);
    expect(mockAudioControls.setIsEnabled).toHaveBeenCalledWith(true);
    expect(screen.getByTestId(MOCK_READ_ON_LOAD_TEST_ID)).toHaveTextContent(
      'Press the select button to confirm sound is working.'
    );

    userEvent.keyboard(`{${Keybinding.SELECT}}`);

    expect(onComplete).toHaveBeenCalledWith({
      passed: true,
      completedAt: now,
    });
  });

  async function passUntilStep(step: number) {
    if (step === 1) return;
    screen.getByText(/Step 1 of 6/);
    userEvent.keyboard(`{${Keybinding.FOCUS_PREVIOUS}}`);

    if (step === 2) return;
    await screen.findByText(/Step 2 of 6/);
    userEvent.keyboard(`{${Keybinding.FOCUS_NEXT}}`);

    if (step === 3) return;
    await screen.findByText(/Step 3 of 6/);
    userEvent.keyboard(`{${Keybinding.PAGE_PREVIOUS}}`);

    if (step === 4) return;
    await screen.findByText(/Step 4 of 6/);
    userEvent.keyboard(`{${Keybinding.PAGE_NEXT}}`);

    if (step === 5) return;
    await screen.findByText(/Step 5 of 6/);
    userEvent.keyboard(`{${Keybinding.SELECT}}`);

    if (step === 6) return;
    throw new Error('Step must be between 1 and 6');
  }

  const buttons = ['Up', 'Down', 'Left', 'Right', 'Select'];
  for (const [index, button] of buttons.entries()) {
    it(`yields a failure result when ${button} button is not working`, async () => {
      const onComplete = jest.fn();
      renderScreen({ onComplete });

      await passUntilStep(index + 1);
      userEvent.click(
        screen.getByRole('button', { name: `${button} Button is Not Working` })
      );

      expect(onComplete).toHaveBeenCalledWith({
        passed: false,
        completedAt: now,
        message: `${button} button is not working.`,
      });
    });
  }

  it('yields a failure result when sound is not working', async () => {
    const onComplete = jest.fn();
    renderScreen({ onComplete });

    await passUntilStep(6);
    userEvent.click(
      screen.getByRole('button', { name: `Sound is Not Working` })
    );

    expect(onComplete).toHaveBeenCalledWith({
      passed: false,
      completedAt: now,
      message: `Sound is not working.`,
    });
  });

  it('cancels the test when the cancel button is pressed', () => {
    const onCancel = jest.fn();
    const onComplete = jest.fn();
    renderScreen({ onCancel, onComplete });

    userEvent.click(screen.getByRole('button', { name: 'Cancel Test' }));
    expect(onCancel).toHaveBeenCalled();
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('renders with default screen reader', async () => {
    render(
      <AccessibleControllerDiagnosticScreen
        onComplete={jest.fn()}
        onCancel={jest.fn()}
      />
    );

    await passUntilStep(6);
  });
});
