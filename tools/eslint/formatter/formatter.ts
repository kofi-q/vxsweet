/**
 * Copied and adapted from:
 * https://github.com/eslint/eslint/blob/d0a5414/lib/cli-engine/formatters/stylish.js
 *
 * Modified to strip Bazel out directory prefixes from filenames for
 * dev/IDE convenience.
 */

import path from 'node:path';
import chalk, { Chalk } from 'chalk';
import table from 'text-table';
import util from 'node:util';
import { ESLint } from 'eslint';

chalk.level = 3;

//------------------------------------------------------------------------------
// Helpers
//------------------------------------------------------------------------------

/**
 * Given a word and a count, append an s if count is not one.
 */
function pluralize(word: string, count: number): string {
  return count === 1 ? word : `${word}s`;
}

//------------------------------------------------------------------------------
// Public Interface
//------------------------------------------------------------------------------
function format(
  results: ESLint.LintResult[],
  data: ESLint.LintResultData
): string {
  let output = '\n';
  let errorCount = 0;
  let warningCount = 0;
  let fixableErrorCount = 0;
  let fixableWarningCount = 0;
  let summaryColor: Chalk = chalk.yellow;

  for (const result of results) {
    const messages = result.messages;

    if (messages.length === 0) {
      continue;
    }

    errorCount += result.errorCount;
    warningCount += result.warningCount;
    fixableErrorCount += result.fixableErrorCount;
    fixableWarningCount += result.fixableWarningCount;

    const relativeFilePath = path.relative(data.cwd, result.filePath);
    output += `${chalk.underline(relativeFilePath)}\n`;

    output += `${table(
      messages.map((message) => {
        let messageType;

        if (message.fatal || message.severity === 2) {
          messageType = chalk.red('error');
          summaryColor = chalk.red;
        } else {
          messageType = chalk.yellow('warning');
        }

        return [
          '',
          message.line || 0,
          message.column || 0,
          messageType,
          message.message.replace(/([^ ])\.$/u, '$1'),
          chalk.dim(message.ruleId || ''),
        ];
      }),
      {
        align: [null, 'r', 'l'],
        stringLength(str: string) {
          return util.stripVTControlCharacters(str).length;
        },
      }
    )
      .split('\n')
      .map((el: string) =>
        el.replace(/(\d+)\s+(\d+)/u, (_: string, p1: string, p2: string) =>
          chalk.dim(`${p1}:${p2}`)
        )
      )
      .join('\n')}\n\n`;
  }

  const total = errorCount + warningCount;

  if (total > 0) {
    output += summaryColor.bold(
      [
        '✖ ',
        total,
        pluralize(' problem', total),
        ' (',
        errorCount,
        pluralize(' error', errorCount),
        ', ',
        warningCount,
        pluralize(' warning', warningCount),
        ')\n',
      ].join('')
    );

    if (fixableErrorCount > 0 || fixableWarningCount > 0) {
      output += summaryColor.bold(
        [
          '  ',
          fixableErrorCount,
          pluralize(' error', fixableErrorCount),
          ' and ',
          fixableWarningCount,
          pluralize(' warning', fixableWarningCount),
          ' potentially fixable with the `--fix` option!!!\n',
        ].join('')
      );
    }
  }

  // Resets output color, for prevent change on top level
  return total > 0 ? chalk.reset(output) : '';
}

const formatterImpl: ESLint.Formatter['format'] = format;

module.exports = formatterImpl;
