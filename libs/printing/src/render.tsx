import '@playwright/browser-chromium';

import { Browser, Page, chromium } from 'playwright';
import ReactDom from 'react-dom/server';
import React from 'react';
import { Buffer } from 'node:buffer';
import { ServerStyleSheet } from 'styled-components';
import {
  ROBOTO_REGULAR_FONT_DECLARATIONS,
  ROBOTO_ITALIC_FONT_DECLARATIONS,
} from '@vx/libs/ui/fonts/roboto';
import { GlobalStyles } from '@vx/libs/ui/themes';
import { VxThemeProvider } from '@vx/libs/ui/themes/vx_theme_provider';
import { FONT_AWESOME_STYLES } from '@vx/libs/ui/fonts/font_awesome_styles';
import { err, ok, type Result } from '@vx/libs/basics/result';

const PLAYWRIGHT_PIXELS_PER_INCH = 96;
const MAX_HTML_CHARACTERS = 5_000_000;

let cachedBrowser: Browser | undefined;

export type PdfError = 'content-too-large';

export interface PaperDimensions {
  width: number;
  height: number;
}

export const PAPER_DIMENSIONS = {
  // Width of exactly 8in results in 1-3 dots of overflow. The overflowing dots print on a line of
  // their own, followed by a mostly blank line. This causes stripes in the printed page.
  Bmd150: { width: 7.975, height: 13.25 },
  Letter: { width: 8.5, height: 11 },
  LetterRoll: { width: 8.5, height: 100 }, // If we make the height infinite the canvas conversion to an image can seg fault. Break into pages beyond 100 inches.
} satisfies Record<string, PaperDimensions>;

export interface MarginDimensions {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export const DEFAULT_MARGIN_DIMENSIONS: MarginDimensions = {
  top: 0.5,
  right: 0.5,
  bottom: 0.5,
  left: 0.5,
} as const;

function inchesToText(inches: number): string {
  return `${inches}in`;
}

const HTML_DOCTYPE = '<!DOCTYPE html>';
const CONTENT_WRAPPER_ID = 'content-wrapper';

// coverage tool breaks on code evaluated within the browser
/* istanbul ignore next */
function getContentHeight(page: Page): Promise<number> {
  return page.evaluate(() => {
    const rect = (
      (document as unknown as Document).getElementById(
        'content-wrapper' // CONTENT_WRAPPER_ID not defined in this scope
      ) as HTMLElement
    ).getBoundingClientRect();
    return rect.height + rect.top;
  });
}

export async function launchBrowser(): Promise<Browser> {
  return await chromium.launch({
    // Font hinting (https://fonts.google.com/knowledge/glossary/hinting) is on by default, but
    // causes fonts to render awkwardly at higher resolutions, so we disable it
    args: ['--font-render-hinting=none'],
  });
}

/* istanbul ignore next - cleanup function for jest */
export async function cleanupCachedBrowser(): Promise<void> {
  if (cachedBrowser) {
    await cachedBrowser.close();
  }
  cachedBrowser = undefined;
}

async function getOrCreateCachedBrowser(): Promise<Browser> {
  if (!cachedBrowser || !cachedBrowser.isConnected()) {
    cachedBrowser = await launchBrowser();
  }
  return cachedBrowser;
}

export interface RenderSpec {
  document: JSX.Element | JSX.Element[];
  paperDimensions?: PaperDimensions;
  marginDimensions?: MarginDimensions;
  outputPath?: string;
  usePrintTheme?: boolean;
}

export async function renderToPdf(
  spec: RenderSpec[],
  browserOverride?: Browser
): Promise<Result<Buffer[], PdfError>>;
export async function renderToPdf(
  spec: RenderSpec,
  browserOverride?: Browser
): Promise<Result<Buffer, PdfError>>;
export async function renderToPdf(
  spec: RenderSpec | RenderSpec[],
  browserOverride?: Browser
): Promise<Result<Buffer | Buffer[], PdfError>> {
  const specs = Array.isArray(spec) ? spec : [spec];

  const browser = browserOverride ?? (await getOrCreateCachedBrowser());
  const context = await browser.newContext();
  const page = await context.newPage();

  const buffers: Buffer[] = [];

  for (const {
    document,
    outputPath,
    paperDimensions: { width, height } = PAPER_DIMENSIONS.Letter,
    marginDimensions = DEFAULT_MARGIN_DIMENSIONS,
    usePrintTheme,
  } of specs) {
    const verticalMargin = marginDimensions.top + marginDimensions.bottom;
    const horizontalMargin = marginDimensions.left + marginDimensions.right;

    // set the viewport size such that the content is the same width as it will
    // be in the PDF, which allows us to determine the necessary height to fit
    // the page to the content. viewport height here is irrelevant, but we have to
    // set something.
    await page.setViewportSize({
      // Noninteger values are not supported
      width: Math.floor(
        (width - horizontalMargin) * PLAYWRIGHT_PIXELS_PER_INCH
      ),
      height: Math.floor(
        (height - verticalMargin) * PLAYWRIGHT_PIXELS_PER_INCH
      ),
    });

    const documentWithGlobalStyles = (
      <React.Fragment>
        {/* Initial report ported from VxAdmin, thus `desktop` theme to match styles */}
        {/* TODO: Migrate older prints to print theme. */}
        <VxThemeProvider
          colorMode={usePrintTheme ? 'print' : 'desktop'}
          sizeMode={usePrintTheme ? 'print' : 'desktop'}
          screenType="builtIn"
        >
          <GlobalStyles />
          <div id={CONTENT_WRAPPER_ID}>{document}</div>
        </VxThemeProvider>
      </React.Fragment>
    );
    const sheet = new ServerStyleSheet();
    const reportHtml = ReactDom.renderToString(
      sheet.collectStyles(documentWithGlobalStyles)
    );
    const style = sheet.getStyleElement();
    sheet.seal();

    const documentHtml = ReactDom.renderToString(
      <html>
        <head>
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
              __html: FONT_AWESOME_STYLES,
            }}
          />
          {style}
        </head>
        <body dangerouslySetInnerHTML={{ __html: reportHtml }} />
      </html>
    );

    // Chromium crashes when trying to render large PDFs
    if (documentHtml.length > MAX_HTML_CHARACTERS) {
      return err('content-too-large');
    }

    // add the doctype so that the browser uses the correct user agent stylesheet
    await page.setContent(`${HTML_DOCTYPE}\n${documentHtml}`, {
      waitUntil: 'load',
    });

    const isLetterRoll = height === PAPER_DIMENSIONS.LetterRoll.height;

    const contentHeight =
      (await getContentHeight(page)) / PLAYWRIGHT_PIXELS_PER_INCH +
      verticalMargin;

    buffers.push(
      await page.pdf({
        path: outputPath,
        width: inchesToText(width),
        height: inchesToText(
          /* if printing on a roll remove any unneeded height but never be smaller than a standard page */
          isLetterRoll
            ? Math.min(
                Math.max(contentHeight, PAPER_DIMENSIONS.Letter.height),
                height
              )
            : height
        ),
        margin: {
          top: inchesToText(marginDimensions.top),
          right: inchesToText(marginDimensions.right),
          bottom: inchesToText(marginDimensions.bottom),
          left: inchesToText(marginDimensions.left),
        },
        printBackground: true, // necessary to render shaded backgrounds
      })
    );
  }

  await context.close();

  return ok(Array.isArray(spec) ? buffers : buffers[0]);
}
