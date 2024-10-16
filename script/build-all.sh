#!/usr/bin/env bash

set -euo pipefail

OPTIONAL_CI_FLAGS=""
if [[ -n "${CI-}" ]]; then
  # See .bazel/ci.bazelrc for related Bazel flags:
  OPTIONAL_CI_FLAGS="--config=ci"
fi

bazel build //... "${OPTIONAL_CI_FLAGS}"
