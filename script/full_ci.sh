#!/usr/bin/env bash

set -euo pipefail

cd "${BUILD_WORKSPACE_DIRECTORY}" || exit 1

bazel test --test_tag_filters= --nobuild_tests_only //...
