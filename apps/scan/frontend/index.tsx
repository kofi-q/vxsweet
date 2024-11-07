import './polyfills';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { DevDock } from '@vx/libs/dev-dock/frontend/src';
import { assert } from '@vx/libs/basics/assert';
import { App } from './app/app';
import { PreviewApp } from './preview/preview_app';

const rootElement = document.getElementById('root');
assert(rootElement);
const root = createRoot(rootElement);

root.render(
  <React.StrictMode>
    {process.env.NODE_ENV === 'development' &&
    window.location.pathname.startsWith('/preview') ? (
      <PreviewApp />
    ) : (
      <React.Fragment>
        <App enableStringTranslation />
        <DevDock />
      </React.Fragment>
    )}
  </React.StrictMode>
);
