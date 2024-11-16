/* eslint-disable @typescript-eslint/no-shadow */
/* eslint-disable vx/gts-identifiers */
import chalk from 'chalk';
import fs from 'node:fs/promises';
import path from 'node:path';
import util from 'node:util';
import { ESLint } from 'eslint';
import { FlatESLint } from 'eslint/use-at-your-own-risk';
import { runWorkerLoop, log } from '@bazel/worker';

chalk.level = 3;

declare module 'eslint/use-at-your-own-risk' {
  class FlatESLint extends ESLint {}
}

const cwd = process.cwd();

const eslint = new FlatESLint({
  overrideConfigFile: process.env.ESLINT_CONFIG_PATH,
  cwd,
});

void runWorkerLoop(async (args) => {
  const {
    positionals: inputPaths,
    values: { outputPath },
  } = util.parseArgs({
    allowPositionals: true,
    args,
    options: {
      outputPath: { short: 'o', type: 'string' },
    },
    strict: true,
  });

  if (!outputPath) {
    log(chalk.red('\n[ERROR] missing output file path\n'));
    return false;
  }

  if (!inputPaths) {
    log(chalk.red('\n[ERROR] missing input file paths\n'));
    return false;
  }

  try {
    const [results, formatter] = await Promise.all([
      eslint.lintFiles(inputPaths),
      eslint.loadFormatter(process.env.ESLINT_FORMATTER_PATH),
    ]);

    let output = '';

    const hasErrors = results.some((r) => r.messages.length === 0);
    if (hasErrors) {
      output = await formatter.format(results, {
        cwd,
        rulesMeta: eslint.getRulesMetaForResults(results),
      });
    }

    await fs.writeFile(path.join(cwd, outputPath), output, 'utf-8');
  } catch (error) {
    log(chalk.red(`\n[ERROR] ESLint failed: ${error}\n`));
    return false;
  }

  return true;
});
