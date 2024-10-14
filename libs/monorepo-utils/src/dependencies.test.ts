import { join } from 'node:path';
import {
  findAllMonorepoDependencies,
  getAllDependencies,
} from './dependencies';
import { getWorkspacePackageInfo } from './pnpm';

test('getAllDependencies merges dependencies fields', () => {
  expect(
    getAllDependencies({
      path: '/path/to/package',
      relativePath: 'package',
      name: 'package',
      version: '1.0.0',
      packageJson: {
        name: 'package',
        version: '1.0.0',
        dependencies: {
          dep1: '1.0.0',
          dep2: '2.0.0',
        },
        devDependencies: {
          devDep1: '1.0.0',
          devDep2: '2.0.0',
        },
        peerDependencies: {
          peerDep1: '1.0.0',
          peerDep2: '2.0.0',
        },
      },
      packageJsonPath: '/path/to/package/package.json',
    })
  ).toEqual({
    dep1: '1.0.0',
    dep2: '2.0.0',
    devDep1: '1.0.0',
    devDep2: '2.0.0',
    peerDep1: '1.0.0',
    peerDep2: '2.0.0',
  });
});

test('getAllDependencies with no package.json', () => {
  expect(
    getAllDependencies({
      path: '/path/to/package',
      relativePath: 'package',
      name: 'package',
      version: '1.0.0',
    })
  ).toEqual({});
});

test.each(['dependencies', 'devDependencies', 'peerDependencies'])(
  'getAllDependencies from %s',
  (field) => {
    expect(
      getAllDependencies({
        path: '/path/to/package',
        relativePath: 'package',
        name: 'package',
        version: '1.0.0',
        packageJson: {
          name: 'package',
          version: '1.0.0',
          [field]: {
            dep1: '1.0.0',
            dep2: '2.0.0',
          },
        },
        packageJsonPath: '/path/to/package/package.json',
      })
    ).toEqual({
      dep1: '1.0.0',
      dep2: '2.0.0',
    });
  }
);

test('findAllMonorepoDependencies yields all dependencies', () => {
  const pkgs = getWorkspacePackageInfo(join(__dirname, '../../..'));
  const basicsPkg = pkgs.get('@vx/libs/basics/src')!;

  // simple dependencies
  expect([...findAllMonorepoDependencies(pkgs, basicsPkg)]).toEqual([
    pkgs.get('eslint-plugin-vx')!,
  ]);

  // no dependencies
  expect([
    ...findAllMonorepoDependencies(pkgs, pkgs.get('eslint-plugin-vx')!),
  ]).toEqual([]);

  // many dependencies
  expect(
    [
      ...findAllMonorepoDependencies(
        pkgs,
        pkgs.get('@vx/apps/mark/frontend/src')!
      ),
    ].map((pkg) => pkg.name)
  ).toEqual(
    // this list is intentionally incomplete to avoid breaking this test
    // when new packages are added or dependencies are changed
    expect.arrayContaining([
      '@vx/libs/basics/src',
      '@vx/libs/fixtures/src',
      '@vx/libs/logging/src',
      '@vx/libs/types/src',
      '@vx/libs/ui/src',
      '@vx/libs/utils/src',
      '@vx/apps/mark/backend/src',
    ])
  );
});
