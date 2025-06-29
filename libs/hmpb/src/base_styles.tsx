import {
  ROBOTO_REGULAR_FONT_DECLARATIONS,
  ROBOTO_ITALIC_FONT_DECLARATIONS,
} from '@vx/libs/ui/fonts/roboto';
import React from 'react';

const baseStyles = `
  *,
  *::before,
  *::after {
    box-sizing: inherit;
  }

  html {
    box-sizing: border-box;
    font-family: Vx Roboto;
    font-variant-ligatures: none;
    /* CCD minimum font size: https://civicdesign.org/typography-makes-ballots-easy-to-read/ */
    font-size: 12pt;
    line-height: 1.2;
  }

  body {
    margin: 0;
  }

  h1, h2, h3, h4, h5, h6 {
    margin: 0;
  }
  h1 {
    font-size: 1.4em;
  }
  h2 {
    font-size: 1.2em;
  }
  h3 {
    font-size: 1.1em;
  }
  h4 {
    font-size: 1em;
  }
  h5 {
    font-size: 1em;
  }
  h6 {
    font-size: 1em;
  }

  ul, ol {
    margin: 0;
    padding: 0;
    list-style: none;
  }
`;

export const baseStyleElements = (
  <React.Fragment>
    <style
      type="text/css"
      dangerouslySetInnerHTML={{
        __html: [
          ROBOTO_REGULAR_FONT_DECLARATIONS,
          ROBOTO_ITALIC_FONT_DECLARATIONS,
        ].join('\n'),
      }}
    />
    <style
      type="text/css"
      dangerouslySetInnerHTML={{
        __html: baseStyles,
      }}
    />
  </React.Fragment>
);
