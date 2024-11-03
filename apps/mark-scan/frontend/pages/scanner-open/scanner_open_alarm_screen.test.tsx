jest.mock(
  '@vx/libs/ui/ui_strings/audio-controls',
  (): typeof import('@vx/libs/ui/ui_strings/audio-controls') => ({
    ...jest.requireActual('@vx/libs/ui/ui_strings/audio-controls'),
    useAudioEnabled: jest.fn(),
  })
);
jest.mock(
  '@vx/libs/ui/ui_strings/screen-reader',
  (): typeof import('@vx/libs/ui/ui_strings/screen-reader') => ({
    ...jest.requireActual('@vx/libs/ui/ui_strings/screen-reader'),
    useAudioControls: () => audioControlsMock,
  })
);

import { mockOf, mockUseAudioControls } from '@vx/libs/test-utils/src';
import { useAudioEnabled } from '@vx/libs/ui/ui_strings/audio-controls';
import { render } from '../../test/react_testing_library';
import { ScannerOpenAlarmScreen } from './scanner_open_alarm_screen';

const audioControlsMock = mockUseAudioControls();

test('mutes audio on render, unmutes on unmount', () => {
  const mockUseAudioEnabled = mockOf(useAudioEnabled);
  mockUseAudioEnabled.mockReturnValue(true);

  const { unmount } = render(<ScannerOpenAlarmScreen />);
  expect(audioControlsMock.setIsEnabled).toHaveBeenLastCalledWith(false);

  unmount();
  expect(audioControlsMock.setIsEnabled).toHaveBeenLastCalledWith(true);
});
