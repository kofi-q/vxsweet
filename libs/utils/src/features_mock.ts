import { type Dictionary } from '@vx/libs/types/basic';
import { BooleanEnvironmentVariableName } from './environment_variable';
import { isFeatureFlagEnabled } from './features';

interface FeatureFlagMock {
  isEnabled: typeof isFeatureFlagEnabled;
  enableFeatureFlag: (flag: BooleanEnvironmentVariableName) => void;
  disableFeatureFlag: (flag: BooleanEnvironmentVariableName) => void;
  resetFeatureFlags: () => void;
}

/**
 * Provides an mock interface to use with `jest.mock` to flexibly mock
 * feature flags in a test environment.
 */
export function getFeatureFlagMock(): FeatureFlagMock {
  let mockedFlags: Dictionary<boolean> = {};

  return {
    isEnabled: (flag: BooleanEnvironmentVariableName) => {
      return mockedFlags[flag] ?? isFeatureFlagEnabled(flag);
    },
    enableFeatureFlag: (flag: BooleanEnvironmentVariableName) => {
      mockedFlags[flag] = true;
    },
    disableFeatureFlag: (flag: BooleanEnvironmentVariableName) => {
      mockedFlags[flag] = false;
    },
    resetFeatureFlags: () => {
      mockedFlags = {};
    },
  };
}
