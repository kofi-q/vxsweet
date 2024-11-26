import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';
import { Server } from 'connect';
import { createProxyMiddleware as proxy } from 'http-proxy-middleware';
import { assertDefined } from '@vx/libs/basics/assert';

// eslint-disable-next-line vx/gts-safe-number-parse
const PORT = Number.parseInt(process.env.PORT || '', 10) || 3000;
const DEV_BACKEND_PORT = process.env['DEV_BACKEND_PORT'] || '3002';

const RUN_IN_WORKSPACE = getBoolFlag('RUN_IN_WORKSPACE');

const REPO_ROOT = assertDefined(
  RUN_IN_WORKSPACE
    ? process.env['BUILD_WORKSPACE_DIRECTORY']
    : process.env['PWD']
);

const SHOULD_EMPTY_OUT_DIR = getBoolFlag('SHOULD_EMPTY_OUT_DIR');

function getBoolFlag(name: string) {
  return Boolean(JSON.parse(process.env[name] || 'false'));
}

export default import('vite').then(({ defineConfig, loadEnv }) =>
  defineConfig((env) => {
    const envPrefix = 'REACT_APP_';
    const rootDotenvValues = loadEnv(env.mode, REPO_ROOT, envPrefix);
    const coreDotenvValues = loadEnv(env.mode, __dirname, envPrefix);
    const processEnvDefines = [
      ...Object.entries(rootDotenvValues),
      ...Object.entries(coreDotenvValues),
    ].reduce<Record<string, string>>(
      (acc, [key, value]) => ({
        ...acc,
        [`process.env.${key}`]: JSON.stringify(value),
      }),
      {}
    );

    return {
      build: {
        // Write build files to `build` directory.
        outDir: 'build',
        emptyOutDir: SHOULD_EMPTY_OUT_DIR,
        commonjsOptions: {
          include: [/.*/],
        },

        target: 'chrome98', // Match kiosk-browser electron version.

        // Do not minify build files. We don't need the space savings and this is
        // a minor transparency improvement.
        minify: false,

        sourcemap: false,
      },

      esbuild: {
        treeShaking: true,
      },

      // Replace some code in Node modules, `#define`-style, to avoid referencing
      // Node-only globals like `process`.
      define: {
        'process.env.NODE_DEBUG': JSON.stringify(undefined),
        'process.platform': JSON.stringify('browser'),
        'process.version': JSON.stringify(process.version),

        // TODO: Replace these with the appropriate `import.meta.env` values (#1907).
        ...processEnvDefines,
      },

      resolve: {
        alias: [
          // Replace NodeJS built-in modules with polyfills.
          //
          // The trailing slash is important for the ones with the same name.
          // Without it, they will be resolved as built-in NodeJS modules.
          { find: 'assert', replacement: require.resolve('assert') },
          { find: 'node:assert', replacement: require.resolve('assert') },
          { find: 'buffer', replacement: require.resolve('buffer') },
          { find: 'node:buffer', replacement: require.resolve('buffer') },
          { find: 'events', replacement: require.resolve('events') },
          { find: 'node:events', replacement: require.resolve('events') },
          {
            find: 'fs',
            replacement: require.resolve('@vx/libs/browser-stubs/fs'),
          },
          {
            find: 'node:fs',
            replacement: require.resolve('@vx/libs/browser-stubs/fs'),
          },
          {
            find: 'jsdom',
            replacement: require.resolve('@vx/libs/browser-stubs/jsdom'),
          },
          { find: 'path', replacement: require.resolve('path') },
          { find: 'node:path', replacement: require.resolve('path') },
          {
            find: 'os',
            replacement: require.resolve('@vx/libs/browser-stubs/os'),
          },
          {
            find: 'node:os',
            replacement: require.resolve('@vx/libs/browser-stubs/os'),
          },
          { find: 'stream', replacement: require.resolve('stream-browserify') },
          {
            find: 'node:stream',
            replacement: require.resolve('stream-browserify'),
          },
          { find: 'util', replacement: require.resolve('util') },
          { find: 'node:util', replacement: require.resolve('util') },
          { find: 'zlib', replacement: require.resolve('browserify-zlib') },
          {
            find: 'node:zlib',
            replacement: require.resolve('browserify-zlib'),
          },

          // Work around a broken `module` entry in pagedjs's `package.json`.
          // https://github.com/vitejs/vite/issues/1488
          {
            find: 'pagedjs',
            replacement: require.resolve('pagedjs/dist/paged.esm'),
          },

          // Work around an internet curmudgeon.
          // Problem: https://github.com/isaacs/node-glob/pull/374
          // Fix: https://github.com/isaacs/node-glob/pull/479
          {
            find: 'glob',
            replacement: require.resolve('@vx/libs/browser-stubs/glob'),
          },
        ],
      },

      plugins: [
        react(),

        (() => {
          const REGEX_VX_IMPORT = /@vx\/(.+)/;
          const cache = new Map<string, string>();

          return {
            name: 'vx-import-path-mapper',
            resolveId(id, importer, options) {
              const match = id.match(REGEX_VX_IMPORT);
              if (!match) {
                return this.resolve(id, importer, options);
              }

              const pathFragment = match.at(1);

              const existingMapping = cache.get(id);
              if (existingMapping) {
                return existingMapping;
              }

              for (const potentialPath of [
                // In Bazel sandbox with pre-built sources:
                `${pathFragment}.js`,
                `${pathFragment}/index.js`,

                // In dev iteration with raw TS sources:
                `${pathFragment}.ts`,
                `${pathFragment}.tsx`,
                `${pathFragment}/index.ts`,
                `${pathFragment}/index.tsx`,
              ]) {
                const absolutePath = path.join(REPO_ROOT, potentialPath);
                if (fs.existsSync(absolutePath)) {
                  cache.set(id, absolutePath);

                  return absolutePath;
                }
              }

              throw new Error(`unrecognized @vx import path: ${id}`);
            },
          };
        })(),

        // Set up proxies to backend APIs when running a dev server.
        {
          name: 'development-proxy',
          configureServer: (app: { middlewares: Server }) => {
            app.middlewares.use(
              proxy({
                // [TODO] Maybe rename the `**/frontend/api` dirs to avoid this:
                pathFilter: (pathname) =>
                  pathname.startsWith('/api') && !/.tsx?$/.test(pathname),
                target: `http://localhost:${DEV_BACKEND_PORT}/`,
              })
            );

            app.middlewares.use(
              proxy({
                pathFilter: '/dock',
                target: `http://localhost:${DEV_BACKEND_PORT}/`,
              })
            );
          },
        },
      ],

      server: {
        port: PORT,
      },

      // Pass some environment variables to the client in `import.meta.env`.
      envPrefix,
    };
  })
);
