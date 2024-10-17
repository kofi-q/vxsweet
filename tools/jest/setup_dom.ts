// styled-components version 5.3.1 and above requires this remapping for jest
// environments, reference: https://github.com/styled-components/styled-components/issues/3570
jest.mock('styled-components', (): typeof import('styled-components') =>
  jest.requireActual('styled-components/dist/styled-components.browser.cjs.js')
);

import '@testing-library/jest-dom/extend-expect';
import 'jest-styled-components';
import fetchMock from 'fetch-mock';
import jestFetchMock from 'jest-fetch-mock';
import { TextDecoder, TextEncoder } from 'node:util';
import * as testingLibraryReact from '@testing-library/react';

testingLibraryReact.configure({ asyncUtilTimeout: 5_000 });

globalThis.TextDecoder = TextDecoder as typeof globalThis.TextDecoder;
globalThis.TextEncoder = TextEncoder as typeof globalThis.TextEncoder;

beforeEach(() => {
  jestFetchMock.enableMocks();
  fetchMock.reset();
  fetchMock.mock();

  // react-gamepad calls this function which does not exist in JSDOM
  if ('navigator' in globalThis) {
    globalThis.navigator.getGamepads = jest.fn(() => []);
  }
});

// Mock some DOM methods that don't exist in jsdom but are required by tiptap
// (our rich text editor library).
// See https://github.com/ueberdosis/tiptap/discussions/4008
function getBoundingClientRect(): DOMRect {
  const rec = {
    x: 0,
    y: 0,
    bottom: 0,
    height: 0,
    left: 0,
    right: 0,
    top: 0,
    width: 0,
  } as const;
  // eslint-disable-next-line vx/gts-identifiers
  return { ...rec, toJSON: () => rec };
}

// eslint-disable-next-line vx/gts-identifiers
class FakeDOMRectList extends Array<DOMRect> implements DOMRectList {
  item(index: number): DOMRect | null {
    return this[index];
  }
}

if ('document' in globalThis) {
  globalThis.document.elementFromPoint = (): null => null;
  HTMLElement.prototype.getBoundingClientRect = getBoundingClientRect;
  HTMLElement.prototype.getClientRects = (): DOMRectList =>
    new FakeDOMRectList();
  Range.prototype.getBoundingClientRect = getBoundingClientRect;
  Range.prototype.getClientRects = (): DOMRectList => new FakeDOMRectList();
}
