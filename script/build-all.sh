#!/usr/bin/env bash

set -euo pipefail

if [[ -z $(which rustc) ]]; then
  # Transitive dependency `libudev-sys` invokes `rustc` directly on the command
  # line in its build script - this makes sure it uses the bazel-provided
  # version.

  # shellcheck disable=SC2147
  RUSTC_PATH="$(bazel info output_base)/external/rules_rust~~rust_host_tools~rust_host_tools/bin/rustc"
  ln -sf "${RUSTC_PATH}" /usr/local/bin/rustc
fi

OPTIONAL_CI_FLAGS=""
if [[ -n "${CI-}" ]]; then
  # See .bazel/ci.bazelrc for related Bazel flags:
  OPTIONAL_CI_FLAGS="--config=ci"
fi

bazel build //... "${OPTIONAL_CI_FLAGS}"
