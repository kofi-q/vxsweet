jest.mock('@vx/libs/ui/src', (): typeof import('@vx/libs/ui/src') => ({
  ...jest.requireActual('@vx/libs/ui/src'),
  useAudioEnabled: jest.fn(),
  useAudioControls: () => audioControlsMock,
}));

import { mockOf, mockUseAudioControls } from '@vx/libs/test-utils/src';
import { useAudioEnabled } from '@vx/libs/ui/src';
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
