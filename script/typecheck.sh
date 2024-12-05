#!/usr/bin/env bash

set -euo pipefail

cd "${BUILD_WORKING_DIRECTORY}" || exit 1

if [[ -z "${1-}" ]]; then
  targets="..."
else
  targets="${*:1}"
fi

bazel build --build_tag_filters=typecheck "${targets}"
