import fs from 'node:fs/promises';
import path from 'node:path';

import config from './version.json';

interface PackageJson {
  dependencies: { [key: string]: string };
  devDependencies: { [key: string]: string };
}

const PLAYWRIGHT_PACKAGE_NAMES = [
  '@playwright/browser-chromium',
  '@playwright/test',
  'playwright',
];

test('all playwright versions are in sync', async () => {
  const { version } = config;
  expect(version).toMatch(/\d+\.\d+\.\d+/);

  const packageJson: PackageJson = JSON.parse(
    await fs.readFile(path.join(__dirname, '../../package.json'), 'utf-8')
  );

  const allDependences = Object.fromEntries(
    Object.entries({
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
    }).filter(([key]) => PLAYWRIGHT_PACKAGE_NAMES.includes(key))
  );

  const expectedDependencies = Object.fromEntries(
    PLAYWRIGHT_PACKAGE_NAMES.map((packageName) => [packageName, version])
  );

  expect(allDependences).toMatchObject(expectedDependencies);
});
