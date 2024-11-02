import { type Timer, time } from '@vx/libs/utils/src';
import { enable as enableDebugger, disable as disableDebugger } from 'debug';
import { rootDebug } from '../util/logging/debug';

export function getPerformanceTimer(): Timer {
  const performanceTimer = time(rootDebug, '');
  enableDebugger('admin-backend:perf*');
  return {
    checkpoint: performanceTimer.checkpoint,
    end: () => {
      const duration = performanceTimer.end();
      disableDebugger();
      return duration;
    },
  };
}
