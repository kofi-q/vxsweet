/* eslint-disable @typescript-eslint/ban-ts-comment */
/* eslint-disable vx/gts-object-literal-types */
// @ts-check

process.title = 'vx-ts-build-worker';

// Quiet JSON import warnings (available via CLI flag only in > Node 21):
// (Copied from https://gist.github.com/mteplyi/81c6f0a8307c605a5f9ab9e11318dcaa)
const originalEmit = process.emit;
// @ts-ignore
process.emit = function (...args) {
  // @ts-ignore
  if (args[0] === 'warning' && args[1]?.name === 'ExperimentalWarning') {
    return false;
  }
  // @ts-ignore
  return originalEmit.apply(process, args);
};

import assert from 'node:assert';
import chalk from 'chalk';
import path from 'node:path';
import tsc from 'typescript';
import { runWorkerLoop, log } from '@bazel/worker';

import tsconfigJson from '../../../tsconfig.json' assert { type: 'json' };

chalk.level = 3;

const CWD = process.cwd();

const BAZEL_EXEC_ROOT = process.env.OLDPWD;
assert(!!BAZEL_EXEC_ROOT);

const BAZEL_BIN_RELATIVE_PATH = path.relative(BAZEL_EXEC_ROOT, CWD);

const TYPES_ROOT_RELATIVE = path.join(
  BAZEL_BIN_RELATIVE_PATH,
  'node_modules/@types'
);

const AMBIENT_TYPES = [
  'compress-commons.d.ts',
  'env.d.ts',
  'jest-styled-components.d.ts',
  'kiosk-browser.d.ts',
  'libs/ui/styled-components/index.d.ts',
  'libs/ui/themes/get_contrast.d.ts',
  'node-quirc.d.ts',
  'stream-chopper.d.ts',
  'zip-stream.d.ts',
];

/** @type {import("typescript").FormatDiagnosticsHost} */
const diagnosticFormatHost = {
  // @ts-ignore
  getCanonicalFileName(fileName) {
    if (!fileName.startsWith('/')) {
      return fileName;
    }
    return path.relative(CWD, fileName);
  },
  getCurrentDirectory: () => CWD,
  getNewLine: () => '\n',
};

tsconfigJson.compilerOptions.allowJs = false;
tsconfigJson.compilerOptions.noEmit = false;
const tsconfig = tsc.convertCompilerOptionsFromJson(
  tsconfigJson.compilerOptions,
  CWD
);
if (tsconfig.errors.length > 0) {
  log(
    chalk.red('\n[ERROR] unable to parse tsconfig.build.json:\n'),
    tsc.formatDiagnosticsWithColorAndContext(
      tsconfig.errors,
      diagnosticFormatHost
    ),
    '\n'
  );

  process.exit(1);
}

void runWorkerLoop((srcPaths, buildInputs) => {
  /** @type {string[]} */
  const npmTypeDirs = [''].slice(1); // [TODO] Figure out why typechecker is ignoring jsdoc.
  for (const buildInput of Object.keys(buildInputs)) {
    const pathPrefix = TYPES_ROOT_RELATIVE + '/';
    if (!buildInput.startsWith(pathPrefix)) {
      continue;
    }

    const packageName = buildInput.substring(pathPrefix.length);
    npmTypeDirs.push(packageName);
  }

  const rootNames = [...srcPaths];
  for (const ambientTypesFile of AMBIENT_TYPES) {
    // [TODO] Fix up - hack to nudge tsc to pick up relevant ambient types.
    if (buildInputs[path.join(BAZEL_BIN_RELATIVE_PATH, ambientTypesFile)]) {
      rootNames.push(ambientTypesFile);
    }
  }

  try {
    const program = tsc.createProgram({
      host: tsc.createIncrementalCompilerHost(tsconfig.options, {
        ...tsc.sys,

        fileExists(filePath) {
          const repoRootRelativePath = path.relative(CWD, filePath);
          if (srcPaths.includes(repoRootRelativePath)) {
            return true;
          }

          return tsc.sys.fileExists(filePath);
        },

        getDirectories(dir) {
          // Limit visibility to only explicitly declared type dependencies.
          if (dir.endsWith(TYPES_ROOT_RELATIVE)) {
            return npmTypeDirs;
          }

          return tsc.sys.getDirectories(dir);
        },

        readFile(filePath, encoding) {
          let filePathResolved = filePath;

          // Read repo-relative paths from the Bazel exec root instead, since
          // they don't exist in the output root. Avoids unnecessarily copying
          // .ts files into the output root and cluttering the runtime import
          // space.
          const repoRootFilePath = path.relative(CWD, filePath);
          if (srcPaths.includes(repoRootFilePath)) {
            filePathResolved = path.join(BAZEL_EXEC_ROOT, repoRootFilePath);
          }

          return tsc.sys.readFile(filePathResolved, encoding);
        },
      }),
      options: tsconfig.options,
      rootNames,
    });

    const result = program.emit();

    const preEmitDiagnostics = tsc.getPreEmitDiagnostics(program);
    if (preEmitDiagnostics.length + result.diagnostics.length > 0) {
      log('\n');
      log(
        tsc.formatDiagnosticsWithColorAndContext(
          [...preEmitDiagnostics, ...result.diagnostics],
          diagnosticFormatHost
        )
      );
      return false;
    }
  } catch (error) {
    log(chalk.red(`\n[ERROR] tsc task failed: ${error}\n`));
    return false;
  }

  return true;
});
