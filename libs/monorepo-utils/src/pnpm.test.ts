import { relative } from 'node:path';
import { getWorkspacePackageInfo, getWorkspacePackagePaths } from './pnpm';

test('getWorkspacePackagePaths', () => {
  expect(getWorkspacePackagePaths(__dirname)).toEqual(
    expect.arrayContaining([
      // workspace root
      '../../..',
      // this package
      '..',
      // basics, as an example library
      '../../basics',
    ])
  );
  expect(getWorkspacePackagePaths(relative(process.cwd(), __dirname))).toEqual(
    expect.arrayContaining([
      // workspace root
      '../../..',
      // this package
      '..',
      // basics, as an example library
      '../../basics',
    ])
  );
});

test('getWorkspacePackageInfo', () => {
  const packages = getWorkspacePackageInfo(__dirname);

  // workspace root
  expect(packages.get('vxsuite')).toEqual(
    expect.objectContaining({
      name: 'vxsuite',
    })
  );

  // this package
  expect(packages.get('@vx/libs/monorepo-utils/src')).toEqual(
    expect.objectContaining({
      name: '@vx/libs/monorepo-utils/src',
    })
  );

  // basics, as an example library
  expect(packages.get('@vx/libs/basics/src')).toEqual(
    expect.objectContaining({
      name: '@vx/libs/basics/src',
    })
  );
});
