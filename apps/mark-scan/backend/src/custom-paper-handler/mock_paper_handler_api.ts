import * as grout from '@vx/libs/grout/src';

import {
  type MockPaperHandlerStatus,
  type PaperHandlerDriverInterface,
  isMockPaperHandler,
} from '@vx/libs/custom-paper-handler/src/driver';

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function buildMockPaperHandlerApi(params: {
  paperHandler?: PaperHandlerDriverInterface;
}) {
  const { paperHandler } = params;

  return grout.createApi({
    getMockPaperHandlerStatus(): MockPaperHandlerStatus | undefined {
      if (!isMockPaperHandler(paperHandler)) {
        return undefined;
      }

      return paperHandler.getMockStatus();
    },

    setMockPaperHandlerStatus(input: {
      mockStatus: MockPaperHandlerStatus;
    }): void {
      if (!isMockPaperHandler(paperHandler)) {
        return;
      }

      paperHandler.setMockStatus(input.mockStatus);
    },
  });
}
