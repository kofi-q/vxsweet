import React from 'react';
import { createRoot } from 'react-dom/client';
import { assert } from '@vx/libs/basics/src';
import { App } from './app/app';

const rootElement = document.getElementById('root');
assert(rootElement);
const root = createRoot(rootElement);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
