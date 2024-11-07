import './polyfills';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { DevDock } from '@vx/libs/dev-dock/frontend/src';
import { assert } from '@vx/libs/basics/assert';
import { App } from './app/app';
import { focusVisible } from './util/focus_visible';

const rootElement = document.getElementById('root');
assert(rootElement);
const root = createRoot(rootElement);

root.render(
  <React.Fragment>
    <App />
    <DevDock />
  </React.Fragment>
);

focusVisible();
