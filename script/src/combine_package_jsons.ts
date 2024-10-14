import assert from 'node:assert';
import fs from 'node:fs/promises';
import path from 'node:path';
import mainPackageJson from '../../package.json';
import semver from 'semver';

// pnpm ls -r --depth=0 --json > package_list.json
import packageList from '../../package_list.json';

type PackageJson = {
  dependencies: Deps;
  devDependencies: Deps;
};

type Deps = { [name: string]: string };

type DepInfo = { version: string };

type DepInfos = { [name: string]: DepInfo };

async function main() {
  const packageJson: PackageJson = mainPackageJson;
  const deps = packageJson.dependencies as Deps;
  const devDeps = packageJson.devDependencies as Deps;

  for (const packages of packageList) {
    mergeDeps(deps, packages.dependencies as unknown as DepInfos);
    mergeDeps(devDeps, packages.devDependencies as unknown as DepInfos);
  }

  for (const depName of Object.keys(deps)) {
    if (devDeps[depName]) {
      delete devDeps[depName];
    }

    if (depName.startsWith('@types') || depName.startsWith('jest')) {
      const dep = deps[depName];
      assert(dep);
      devDeps[depName] = dep;

      delete deps[depName];
    }
  }

  packageJson.dependencies = Object.fromEntries(
    Object.entries(deps).sort(([a], [b]) => a.localeCompare(b))
  ) as Deps;

  packageJson.devDependencies = Object.fromEntries(
    Object.entries(devDeps).sort(([a], [b]) => a.localeCompare(b))
  ) as Deps;

  await fs.writeFile(
    path.join(__dirname, '../../package.json'),
    JSON.stringify(packageJson, undefined, 2),
    'utf-8'
  );
}

function mergeDeps(into: Deps, from: DepInfos) {
  if (!from) {
    return;
  }

  for (const [name, info] of Object.entries(from)) {
    if (!info) {
      continue;
    }

    assert(typeof info === 'object' && 'version' in info);

    if (typeof info.version === 'string' && info.version.startsWith('link')) {
      continue; // Deal with these later via bazel.
    }

    let resolvedVersion = info.version;

    /** @type {string | undefined} */
    const existingVersion = into[name];
    if (
      existingVersion &&
      semver.gt(getMinVersion(existingVersion), getMinVersion(info.version))
    ) {
      resolvedVersion = existingVersion;
    }

    into[name] = resolvedVersion;
  }
}

function getMinVersion(versionOrRange?: string) {
  if (!versionOrRange) {
    throw new Error(`empty version: ${versionOrRange}`);
  }

  const range = semver.validRange(versionOrRange);
  assert(range);
  const versionInfo = semver.minVersion(range);
  if (!versionInfo) {
    throw new Error(`invalid version found: ${versionOrRange}`);
  }

  return versionInfo.version;
}

main()
  .then(() => {
    console.log('done');
    process.exit(0);
  })
  .catch((err) => {
    console.error('failed:', err);
    process.exit(1);
  });
