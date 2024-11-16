import chalk from 'chalk';
import fs from 'node:fs/promises';
import process from 'node:process';

chalk.level = 3;

async function main() {
  let hasErrors = false;

  for (let i = 2; i < process.argv.length; i += 1) {
    const filePath = process.argv[i];
    const contents = await fs.readFile(filePath, 'utf8');
    if (contents.length === 0) {
      continue;
    }

    hasErrors = true;
    console.error(contents);
  }

  process.exit(hasErrors ? 1 : 0);
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error(
      chalk.red('\n[ERROR] unable to read ESLint output:', error, '\n')
    );
    process.exit(1);
  });
