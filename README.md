## Disclaimer

This is an unofficial, independent, and experimental fork of VotingWorks'
[VxSuite](https://github.com/votingworks/vxsuite) voting system.

## Overview

This is an exploration of a parallel reality where the build system is managed
with [Bazel](https://bazel.build/) (or similar tooling).

#### Combined Configuration

All `package.json` files have been consolidated into the root `package.json`,
dropping the previous `pnpm` workspaces setup. This attempts to simplify the
task of keeping dependency versions consistent across the codebase and reducing
the overhead of creating new packages. This required moving aliased
`@votingworks/` import paths over to the `tsconfig` `compilerOptions.paths`
feature.

All `tsconfig.json` files have also been consolidated into the root config to
simplify the scope of the prototype. This hasn't had a noticeable performance
impact on the development/IDE workflow, since the repo is still fairly small,
but likely won't scale for a much larger repo. At that point, it should be
fairly straightforward to extend this approach to auto-generate/manage tsconfig
project references.

In the same spirit of simplification, all other relevant configuration files
have been consolidated (`eslint`, `vite`, `playwright`, etc).

#### Bazel

TODO

#### Package Splitting

TODO

#### Typescript Build Improvements

TODO

#### Test Improvements

TODO

#### Test Improvements

TODO

## Development & Build

TODO

### Install Bazelisk (Bazel Version Manager):

```sh
./script/install_bazel.sh
```

### Set Up Dev Tooling:

```sh
bazel run //:dev_env
```

### Build/Test a Target:

```sh
bazel build //libs/basics/collections
bazel build //libs/ballot-interpreter:rust
```

```sh
bazel test //libs/basics/collections:tests
bazel test //libs/ballot-interpreter:rust_tests
```

Run again to see cached results.

### Build Targets Recursively:

```sh
bazel build //libs/basics/...
```

```sh
bazel test //libs/basics/...
```

### Run Typescript Typechecker:

```sh
bazel run //:typecheck //libs/basics/...
```

### Run ESLint:

```sh
bazel run //:lint //libs/basics/...
```

### Build and Run an App:

```sh
bazel run //apps/mark:prod
bazel run //apps/mark:dev
```

All necessary dependencies will be built before running.

## License

GPLv3
